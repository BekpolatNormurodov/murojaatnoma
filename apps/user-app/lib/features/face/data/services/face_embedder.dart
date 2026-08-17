import 'dart:math' as math;
import 'dart:typed_data';

import 'package:tflite_flutter/tflite_flutter.dart';
import 'package:user_app/core/constants/face_constants.dart';

/// `assets/models/mobilefacenet.tflite` (MobileFaceNet) TFLite modelini
/// yuklaydi va `kFaceInputSize x kFaceInputSize` RGB kadrdan L2-normalized,
/// `kFaceEmbeddingSize` uzunlikdagi yuz embeddingini hisoblaydi.
///
/// `worker_app/features/face/data/services/face_embedder.dart` bilan bir
/// xil — bu klass kamera/UI/kesish (crop) logikasini bilmaydi, faqat
/// allaqachon tayyorlangan `rgb112` baytlarini qabul qiladi.
///
/// **Model-siz fallback**: `assets/models/mobilefacenet.tflite` hozircha
/// placeholder bo'lishi mumkin (haqiqiy MobileFaceNet emas — qarang:
/// `assets/models/README.md`). Bunday holda [load] HECH QACHON xato
/// tashlamaydi — o'rniga [isFallback]ni `true`ga o'rnatadi, [embed] esa
/// haqiqiy piksellardan hisoblangan, deterministik "idrok" (perceptual)
/// embeddingga ([_fallbackEmbed]) o'tadi. Fuqaro ilovasida bu embedding
/// faqat SAQLASH uchun ishlatiladi (kunlik tekshiruv yo'q) — shuning uchun
/// fallback rejimi enrollment oqimini hech qachon to'xtatmaydi.
class FaceEmbedder {
  static const _modelAssetPath = 'assets/models/mobilefacenet.tflite';
  static const _fallbackGrid = 8;

  Interpreter? _interpreter;

  /// `true` — haqiqiy `.tflite` model yuklanmagan (placeholder/xato), demak
  /// [embed] piksel-asosli fallbackka o'tadi.
  bool get isFallback => _fallback;
  var _fallback = false;

  /// Modelni asset'dan (lazy) yuklaydi. Allaqachon yuklangan (yoki
  /// fallbackka tushib bo'lingan) bo'lsa hech narsa qilmaydi (idempotent).
  ///
  /// **HECH QACHON xato tashlamaydi**: asset placeholder/yaroqsiz bo'lsa,
  /// istisno shu yerda ushlanadi va [isFallback] `true`ga o'rnatiladi.
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
  /// L2-normalized embedding vektorini hisoblaydi. **Hech qachon
  /// `StateError` tashlamaydi**.
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

  double _normalizePixel(int channel) => channel / 127.5 - 1.0;

  /// **Model-siz idrok (perceptual) embedding** — [isFallback] bo'lganda
  /// ishlatiladi. Luma + gorizontal/vertikal gradient panjaralaridan
  /// (har biri alohida standartlashtirilgan) yig'ilgan, haqiqiy piksellardan
  /// hisoblangan deterministik vektor — `worker_app`dagi bir xil algoritm
  /// (qarang: o'sha faylning batafsil izohi).
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
  /// standartlashtiradi. `std == 0` bo'lsa nolga bo'linishning oldi
  /// olinadi — natija nol vektor.
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

  /// `v`ni L2-normalizatsiya qiladi (birlik uzunlikka keltiradi). Sof,
  /// statik yordamchi funksiya — model/interpreter'ga bog'liq emas.
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
