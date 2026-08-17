import 'dart:math' as math;
import 'dart:typed_data';

import 'package:tflite_flutter/tflite_flutter.dart';
import 'package:worker_app/core/constants/app_constants.dart';

/// `assets/models/mobilefacenet.tflite` (MobileFaceNet) TFLite modelini
/// yuklaydi va `kFaceInputSize x kFaceInputSize` RGB kadrdan L2-normalized,
/// `kFaceEmbeddingSize` uzunlikdagi yuz embeddingini hisoblaydi.
///
/// Bu klass kamera/UI/kesish (crop) logikasini bilmaydi — faqat allaqachon
/// tayyorlangan `rgb112` baytlarini qabul qiladi.
///
/// **Model-siz fallback**: `assets/models/mobilefacenet.tflite` hozircha
/// placeholder bo'lishi mumkin (haqiqiy MobileFaceNet emas — qarang:
/// `assets/models/README.md`). Bunday holda [load] HECH QACHON xato
/// tashlamaydi — o'rniga [isFallback]ni `true`ga o'rnatadi, [embed] esa
/// haqiqiy piksellardan hisoblangan, deterministik "idrok" (perceptual)
/// embeddingga ([_fallbackEmbed]) o'tadi. Shu tufayli demo/mock rejimda
/// yuz oqimi HECH QACHON "model xatosi"ga tiqilib qolmaydi; haqiqiy
/// `.tflite` qo'yilgach, keyingi `load()` avtomatik ravishda haqiqiy
/// modelga o'tadi (`isFallback == false`).
class FaceEmbedder {
  /// `pubspec.yaml`dagi `flutter.assets` ro'yxatida e'lon qilingan to'liq
  /// asset yo'li. `Interpreter.fromAsset` (`rootBundle.load` orqali) aynan
  /// shu to'liq yo'lni (`assets/` prefiksi bilan) kutadi.
  static const _modelAssetPath = 'assets/models/mobilefacenet.tflite';

  /// [_fallbackEmbed] blok-panjarasining tomoni (8x8=64 blok). `blockSize`
  /// (`kFaceInputSize ~/ _fallbackGrid` = 14px) qoldiqsiz bo'linadi.
  static const _fallbackGrid = 8;

  Interpreter? _interpreter;

  /// `true` — haqiqiy `.tflite` model yuklanmagan (placeholder/xato), demak
  /// [embed] piksel-asosli fallbackka o'tadi. Chaqiruvchilar (`FaceCubit`)
  /// buni mos chegarani (`kFaceMatchFallbackThreshold` vs
  /// `kFaceMatchThreshold`) tanlash uchun o'qiydi.
  bool get isFallback => _fallback;
  var _fallback = false;

  /// Modelni asset'dan (lazy) yuklaydi. Allaqachon yuklangan (yoki
  /// fallbackka tushib bo'lingan) bo'lsa hech narsa qilmaydi (idempotent).
  ///
  /// **HECH QACHON xato tashlamaydi**: asset placeholder/yaroqsiz bo'lsa
  /// (hozirgi demo holati), istisno shu yerda ushlanadi va [isFallback]
  /// `true`ga o'rnatiladi — chaqiruvchi (`FaceCubit.startCamera`) endi
  /// `FaceModelError`ga tushmaydi, yuz oqimi fallback bilan davom etadi.
  /// `on Object` (aniq `Error` klauzasi emas) atayin: TFLite plagini
  /// vaqti-vaqti bilan `Error` avlodlarini tashlaydi va bu — placeholder
  /// asset kutilgan holat, dastur davom etishi kerak.
  Future<void> load() async {
    if (_interpreter != null || _fallback) return;
    try {
      _interpreter = await Interpreter.fromAsset(_modelAssetPath);
    } on Object catch (_) {
      _fallback = true;
    }
  }

  /// `rgb112` (row-major RGB, `kFaceInputSize * kFaceInputSize * 3` bayt
  /// deb faraz qilinadi) asosida `kFaceEmbeddingSize` uzunlikdagi,
  /// L2-normalized embedding vektorini hisoblaydi.
  ///
  /// Haqiqiy model yuklangan bo'lsa ([isFallback] `false`) — TFLite
  /// inference orqali. Aks holda ([isFallback] `true`, yoki `load()` hali
  /// chaqirilmagan) — [_fallbackEmbed]: haqiqiy piksellardan hisoblangan,
  /// model-siz idrok embeddingi. **Hech qachon `StateError` tashlamaydi**
  /// (avvalgi xatti-harakatdan ATAYLAB farqli).
  List<double> embed(Uint8List rgb112) {
    _checkLength(rgb112);

    final interpreter = _interpreter;
    if (interpreter == null) {
      return _fallbackEmbed(rgb112);
    }

    final input = _preprocess(rgb112);
    final output = [List<double>.filled(kFaceEmbeddingSize, 0)];

    interpreter.run(input, output);

    return l2normalize(output.first);
  }

  /// `rgb112` uzunligini tekshiradi — real va fallback yo'llarning
  /// ikkalasi ham shu shartga tayanadi.
  void _checkLength(Uint8List rgb112) {
    const expectedLength = kFaceInputSize * kFaceInputSize * 3;
    if (rgb112.length != expectedLength) {
      throw ArgumentError(
        "rgb112 uzunligi noto'g'ri: kutilgan $expectedLength bayt, "
        'kelgan ${rgb112.length} bayt.',
      );
    }
  }

  /// `rgb112` baytlarini `[1, kFaceInputSize, kFaceInputSize, 3]` shaklidagi
  /// float32 kirish tensoriga aylantiradi; har bir piksel kanali
  /// `(px / 127.5) - 1.0` orqali `[-1, 1]` oralig'iga normalized qilinadi.
  List<List<List<List<double>>>> _preprocess(Uint8List rgb112) {
    return [
      List.generate(
        kFaceInputSize,
        (row) => List.generate(kFaceInputSize, (col) {
          final base = (row * kFaceInputSize + col) * 3;
          return [
            _normalizePixel(rgb112[base]),
            _normalizePixel(rgb112[base + 1]),
            _normalizePixel(rgb112[base + 2]),
          ];
        }),
      ),
    ];
  }

  /// `[0, 255]` oralig'idagi piksel kanalini `[-1, 1]` oralig'iga
  /// o'tkazadi.
  double _normalizePixel(int channel) => channel / 127.5 - 1.0;

  /// **Model-siz idrok (perceptual) embedding** — [isFallback] bo'lganda
  /// ishlatiladi. `kFaceEmbeddingSize` (192) o'lchamli vektorni UCHTA
  /// `_fallbackGrid x _fallbackGrid` (8x8=64 element) panjaradan yig'adi:
  ///
  /// 1. **Luma panjarasi** — har bir 14x14 blokning o'rtacha (standart
  ///    R/G/B → luma formulasidan) yorqinligi: yuzning yumshoq fazoviy
  ///    joylashuvini (ko'z-soqqa, burun, og'iz soyalari qayerda) ushlaydi.
  /// 2. **Gorizontal gradient panjarasi** — luma panjarasi ustidan
  ///    markaziy farqlar (`d luma / dx`): vertikal chekkalarni (burun
  ///    ko'prigi, yuz konturi) ushlaydi.
  /// 3. **Vertikal gradient panjarasi** — xuddi shunday, `d luma / dy`:
  ///    gorizontal chekkalarni (qoshlar, ko'z-qovoq chizig'i, og'iz
  ///    chizig'i, jag') ushlaydi — bular haqiqiy yuz GEOMETRIYASIGA
  ///    (nisbiy joylashuvga) bog'liq, faqat yorqinlikka qaraganda ancha
  ///    farqlovchi (discriminative) signal.
  ///
  /// Uchala panjara ALOHIDA-ALOHIDA **standartlashtiriladi** ([_standardize]:
  /// z-score, `(v - o'rtacha) / std`) va SO'NGRA tekislanadi
  /// (`64*3=192=kFaceEmbeddingSize`). Alohida standartlashtirish MUHIM: bitta
  /// umumiy o'rtachani butun (tekislangan) vektordan ayirish YETARLI EMAS —
  /// yorqinlik (luma) qiymatlari (0..255 miqyosida) gradient qiymatlaridan
  /// (allaqachon ~0-markazli, kichik) kattaligi bo'yicha ustun bo'lib,
  /// gradient panjaralarini deyarli bitta doimiy siljishga aylantirib
  /// qo'yar edi — natijada kosinus o'xshashlik ikkita MUTLAQO BOSHQA yuz
  /// orasida ham kutilganidan ancha yuqori chiqardi (sinovda tasdiqlangan
  /// regressiya: ~0.84). Har bir panjara o'zining o'rtacha/std'iga nisbatan
  /// standartlashtirilgach, kosinus o'xshashlik aslida Pearson
  /// korrelyatsiyasiga yaqinlashadi — bu ikki PANJARA NAQSHI o'rtasidagi
  /// haqiqiy farqni ancha kuchliroq ajratadi. Oxirida [l2normalize]
  /// qilinadi.
  ///
  /// **Haqiqiy va deterministik**: xuddi shu piksellar → xuddi shu vektor;
  /// boshqa yuz (boshqa piksel taqsimoti) → sezilarli boshqa vektor. Hech
  /// qanday tasodifiylik yo'q — bu haqiqiy pikseldan hisoblangan signal,
  /// soxta/qattiq-kodlangan qiymat emas. MobileFaceNet kabi o'rgangan
  /// modelga qaraganda ajratuvchanligi (separability) past — bu kutilgan
  /// va hujjatlashtirilgan chegara (shuning uchun
  /// `kFaceMatchFallbackThreshold` `kFaceMatchThreshold`dan yumshoqroq):
  /// haqiqiy model qo'yilganda aniqlik avtomatik oshadi.
  List<double> _fallbackEmbed(Uint8List rgb112) {
    const grid = _fallbackGrid;
    const blockSize = kFaceInputSize ~/ grid;

    final luma = List<double>.filled(grid * grid, 0);
    for (var by = 0; by < grid; by++) {
      for (var bx = 0; bx < grid; bx++) {
        var sum = 0.0;
        for (var y = 0; y < blockSize; y++) {
          for (var x = 0; x < blockSize; x++) {
            final px = bx * blockSize + x;
            final py = by * blockSize + y;
            final base = (py * kFaceInputSize + px) * 3;
            sum +=
                0.299 * rgb112[base] +
                0.587 * rgb112[base + 1] +
                0.114 * rgb112[base + 2];
          }
        }
        luma[by * grid + bx] = sum / (blockSize * blockSize);
      }
    }

    final gradX = List<double>.filled(grid * grid, 0);
    final gradY = List<double>.filled(grid * grid, 0);
    for (var y = 0; y < grid; y++) {
      for (var x = 0; x < grid; x++) {
        final left = luma[y * grid + math.max(0, x - 1)];
        final right = luma[y * grid + math.min(grid - 1, x + 1)];
        final up = luma[math.max(0, y - 1) * grid + x];
        final down = luma[math.min(grid - 1, y + 1) * grid + x];
        gradX[y * grid + x] = (right - left) / 2;
        gradY[y * grid + x] = (down - up) / 2;
      }
    }

    final descriptor = [
      ..._standardize(luma),
      ..._standardize(gradX),
      ..._standardize(gradY),
    ];
    return l2normalize(descriptor);
  }

  /// `values`ni o'z o'rtachasi/standart chetlanishiga (z-score) nisbatan
  /// standartlashtiradi: `(v - o'rtacha) / std`. Natija nol-o'rtacha va
  /// (agar `std > 0` bo'lsa) birlik dispersiyaga ega — qarang:
  /// [_fallbackEmbed] hujjatidagi izoh (nega bitta umumiy o'rtacha YETARLI
  /// EMASLIGI). `std == 0` (masalan butunlay bir xil rangdagi blok) bo'lsa
  /// nolga bo'linishning oldi olinadi — natija nol vektor (bu blok
  /// haqiqatan ham hech qanday farqlovchi ma'lumot bermaydi).
  List<double> _standardize(List<double> values) {
    final mean = values.reduce((a, b) => a + b) / values.length;
    var variance = 0.0;
    for (final v in values) {
      variance += (v - mean) * (v - mean);
    }
    final std = math.sqrt(variance / values.length);
    if (std == 0) return List<double>.filled(values.length, 0);
    return [for (final v in values) (v - mean) / std];
  }

  /// `v`ni L2-normalizatsiya qiladi (birlik uzunlikka keltiradi).
  ///
  /// Sof, statik yordamchi funksiya — model/interpreter'ga bog'liq emas,
  /// shuning uchun interpreter hech qachon yuklanmasdan ham test qilinishi
  /// mumkin.
  ///
  /// `v` nol vektor bo'lsa (norma 0), nolga bo'linishning oldini olish
  /// uchun `v`ning o'zgarishsiz nusxasi qaytariladi — bu holatda natija
  /// baribir nol vektor bo'ladi (chunki norma faqat barcha elementlar aynan
  /// 0 bo'lgandagina 0 bo'la oladi).
  static List<double> l2normalize(List<double> v) {
    var sumOfSquares = 0.0;
    for (final value in v) {
      sumOfSquares += value * value;
    }
    final norm = math.sqrt(sumOfSquares);
    if (norm == 0) {
      return List<double>.from(v);
    }
    return [for (final value in v) value / norm];
  }
}
