import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:permission_handler/permission_handler.dart';
import 'package:user_app/core/constants/face_constants.dart';
import 'package:user_app/features/face/data/services/face_detector_service.dart';
import 'package:user_app/features/face/data/services/face_embedder.dart';
import 'package:user_app/features/face/data/services/face_photo_store.dart';
import 'package:user_app/features/face/domain/entities/face_template.dart';
import 'package:user_app/features/face/domain/usecases/enroll_face.dart';

part 'face_state.dart';

/// Fuqaroning yuzini ro'yxatdan o'tkazuvchi (identity enrollment) Cubit.
///
/// `worker_app/features/face/presentation/bloc/face_cubit.dart`ning
/// ENROLLMENT-QISMIGA mos — lekin liveness/check-in/geofence YO'Q (fuqaro
/// ilovasida kunlik yuz-tekshiruvi yo'q, faqat bir martalik ro'yxatdan
/// o'tkazish, keyin PIN bilan qulflanadi — qarang: `features/pin/`).
///
/// Ikki qatlamga amal qiladi:
/// - **Qurilma-only**: kamera oqimi, ML Kit, TFLite, 112x112 kesish —
///   faqat haqiqiy qurilmada tekshiriladi (`onFrame`, `capture`).
/// - **Sof mantiq**: [onDetection] (sifat-gate holat mashinasi) hech
///   qanday Flutter/kamera/model chaqiruvisiz ishlaydi, shuning uchun
///   unit-testda sintetik `DetectedFace` bilan to'liq tekshiriladi.
///
/// **Barqarorlik vaqti clock'i**: `stableDuration` va `clock` konstruktor
/// orqali inject qilinadi (standart holatda `DateTime.now`) — testlarda
/// haqiqiy vaqt farqini kutmasdan, qo'lda "oldinga surish" orqali
/// deterministik tekshiriladi.
class FaceCubit extends Cubit<FaceState> {
  FaceCubit({
    required FaceDetectorService detector,
    required FaceEmbedder embedder,
    required EnrollFace enrollFace,
    required String ownerId,
    FacePhotoStore? facePhotoStore,
    Duration stableDuration = const Duration(milliseconds: 1500),
    DateTime Function() clock = DateTime.now,
  }) : _detector = detector,
       _embedder = embedder,
       _enrollFace = enrollFace,
       _ownerId = ownerId,
       _facePhotoStore = facePhotoStore,
       _stableDuration = stableDuration,
       _clock = clock,
       super(const FaceInitializing());

  final FaceDetectorService _detector;
  final FaceEmbedder _embedder;
  final EnrollFace _enrollFace;
  final String _ownerId;

  /// Skanerlangan yuz kadrini profil avatari uchun saqlovchi (ixtiyoriy —
  /// `null` bo'lsa rasm saqlanmaydi, ro'yxatdan o'tkazish o'zgarishsiz
  /// davom etadi). Best-effort, qurilma-only.
  final FacePhotoStore? _facePhotoStore;
  final Duration _stableDuration;
  final DateTime Function() _clock;

  /// `onFrame` hali chaqirilmagan bo'lsa (masalan sof-mantiq testlarida)
  /// sifat-gate shu kadr o'lchamini faraz qiladi. Qurilmada birinchi
  /// haqiqiy kadr kelishi bilan darhol haqiqiy o'lchamga yangilanadi.
  static const _defaultFrameSize = Size(1280, 720);

  // ---- Sifat-gate chegaralari — worker-app bilan BIR XIL (haqiqiy qurilmada
  // sinalgan, yumshoqroq) qiymatlar. Ilgari user-app ancha qattiq edi
  // (markaz 0.16, euler 12, min 0.28) — shu bois yaxshi joylashgan yuz ham
  // o'tmasdi; endi ikkala ilova bir xil, ishonchli o'tadi.
  static const _minFaceRelativeSize = 0.14;
  static const _maxFaceRelativeSize = 0.9;
  static const _maxCenterOffsetFraction = 0.30;
  static const _maxHeadEulerDegrees = 20.0;
  static const _minEyeOpenProbability = 0.30;

  CameraController? _controller;

  /// Old kamera tavsifi — `_bindCamera` (va uning jim-xatolikdan keyingi
  /// qayta-bog'lanishi) uni QAYTA ishlatishi uchun saqlanadi.
  CameraDescription? _front;
  InputImageRotation _rotation = InputImageRotation.rotation0deg;
  Size _frameSize = _defaultFrameSize;
  CameraImage? _lastImage;
  DetectedFace? _lastFace;
  DateTime? _stableSince;
  var _embedderLoaded = false;
  var _streaming = false;

  /// `onFrame`da bitta `detect()` faol bo'lganda `true` — kadrlarni ketma-ket
  /// qayta ishlash uchun (ML Kit `processImage`ni parallel chaqirib bo'lmaydi).
  var _detecting = false;
  var _busy = false;
  var _finished = false;

  /// **Jim-bog'lanish (silent-bind) qo'riqchisi.** Ba'zi qurilmalarda
  /// (Vivo/legacy old kamera) CameraX Preview + ImageCapture + ImageAnalysis
  /// (3 ta surface) kombinatsiyasini bog'lay olmaydi — va bu xato
  /// `startImageStream()` future'i ALLAQACHON muvaffaqiyatli qaytgandan
  /// KEYIN, ASINXRON tarzda otiladi. Shu bois `startImageStream`ni
  /// `try/catch`ga o'rash uni USHLAMAYDI: oqim jim o'ladi, bironta ham kadr
  /// kelmaydi va ekran abadiy `FaceSearching`da qotib qoladi ("apk da
  /// aniqlamaydi"). Qo'riqchi: oqim boshlangach 3 soniya ichida BIRINCHI kadr
  /// kelmasa, bog'lanish jim muvaffaqiyatsiz bo'lgan deb hisoblaymiz va YANGI
  /// kontroller bilan qayta bog'lanamiz (bog'lanish intermitent — qayta
  /// urinishda odatda ochiladi). Birinchi kadr kelishi bilan (`onFrame`)
  /// darhol bekor qilinadi.
  Timer? _bindWatchdog;
  var _firstFrameReceived = false;
  var _bindAttempts = 0;
  static const _maxBindAttempts = 5;

  /// Sahifa `CameraPreview` qurishi uchun joriy kontroller (kamera hali
  /// tayyor bo'lmasa `null`).
  CameraController? get controller => _controller;

  // ================= Qurilma-only: kamera hayot-sikli =================

  /// Ruxsatni so'raydi, old kamerani NV21/BGRA8888 formatida ishga
  /// tushiradi, yuz-embedding modelini yuklaydi va kadr oqimini
  /// boshlaydi. Har bir bosqich xatosi mos `FaceState`ga aylantiriladi —
  /// hech qachon uncaught qolmaydi.
  Future<void> startCamera() async {
    _finished = false;
    _busy = false;
    _stableSince = null;
    _bindAttempts = 0;
    _firstFrameReceived = false;
    _bindWatchdog?.cancel();
    emit(const FaceInitializing());

    final PermissionStatus permission;
    try {
      permission = await Permission.camera.request();
    } on Object {
      emit(const FaceCameraError());
      return;
    }
    if (!permission.isGranted) {
      emit(
        FacePermissionDenied(permanentlyDenied: permission.isPermanentlyDenied),
      );
      return;
    }

    try {
      final cameras = await availableCameras();
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );
      _front = front;
      _rotation =
          InputImageRotationValue.fromRawValue(front.sensorOrientation) ??
          InputImageRotation.rotation0deg;
    } on Object {
      emit(const FaceCameraError());
      return;
    }

    try {
      await _embedder.load();
      _embedderLoaded = true;
    } on Object {
      emit(const FaceModelError());
      return;
    }

    await _bindCamera();
  }

  /// Old kamerani ochib, kadr oqimini boshlaydi va jim-bog'lanish
  /// qo'riqchisini (`_bindWatchdog`) qurollantiradi. `startImageStream`
  /// SINXRON xato bersa (kamdan-kam) darhol qayta urinamiz; ASINXRON jim
  /// xato bersa (ko'p uchraydigan Vivo/legacy holati — qarang: `_bindWatchdog`
  /// izohi) qo'riqchi 3 soniyada kadr kelmaganini sezib qayta bog'laydi.
  /// `medium` — `low` juda xira bo'lgani uchun (user talabi).
  Future<void> _bindCamera() async {
    final front = _front;
    if (front == null || _finished) return;
    _bindWatchdog?.cancel();
    try {
      final controller = CameraController(
        front,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isIOS
            ? ImageFormatGroup.bgra8888
            : ImageFormatGroup.yuv420,
      );
      await controller.initialize();
      await controller.lockCaptureOrientation(DeviceOrientation.portraitUp);
      _controller = controller;
      emit(const FaceSearching());
      _streaming = true;
      await controller.startImageStream(onFrame);
      // Jim-bog'lanish qo'riqchisi: 3s ichida birinchi kadr kelmasa,
      // bog'lanish asinxron muvaffaqiyatsiz bo'lgan — qayta bog'lanamiz.
      _bindWatchdog = Timer(const Duration(seconds: 3), () {
        if (_finished || _firstFrameReceived) return;
        unawaited(_rebindAfterSilentFailure());
      });
    } on Object {
      await _rebindAfterSilentFailure();
    }
  }

  /// Bog'lanish (sinxron yoki jim-asinxron) muvaffaqiyatsiz bo'lganda joriy
  /// kontrollerni tozalab, YANGI kontroller bilan qayta bog'lanadi
  /// (`_maxBindAttempts` martagacha). Chekka holatda `FaceCameraError`
  /// chiqadi — hech qachon abadiy `FaceSearching`da qotib qolmaydi.
  Future<void> _rebindAfterSilentFailure() async {
    _bindWatchdog?.cancel();
    _streaming = false;
    final controller = _controller;
    _controller = null;
    try {
      await controller?.dispose();
    } on Object {
      // jim
    }
    _bindAttempts++;
    if (_finished) return;
    if (_bindAttempts >= _maxBindAttempts) {
      emit(const FaceCameraError());
      return;
    }
    await Future<void>.delayed(const Duration(milliseconds: 400));
    await _bindCamera();
  }

  /// Ilova background'ga o'tganda kadr oqimini to'xtatadi (batareya/CPU
  /// tejash) — kontroller o'zi disposed qilinmaydi, faqat oqim.
  Future<void> pauseCamera() async {
    _bindWatchdog?.cancel();
    final controller = _controller;
    if (controller == null || !_streaming) return;
    try {
      await controller.stopImageStream();
    } on Object {
      // Fon rejimiga o'tayotganda — jim o'tkazib yuboriladi.
    }
    _streaming = false;
  }

  /// Ilova qayta oldinga chiqqanda oqimni tiklaydi; kontroller allaqachon
  /// yo'qolgan bo'lsa, to'liq qayta ishga tushiradi.
  Future<void> resumeCamera() async {
    if (_finished) return;
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      await startCamera();
      return;
    }
    if (_streaming) return;
    await _startStream();
  }

  Future<void> _startStream() async {
    final controller = _controller;
    if (controller == null) return;
    try {
      _streaming = true;
      await controller.startImageStream(onFrame);
    } on Object {
      _streaming = false;
      emit(const FaceCameraError());
    }
  }

  /// Kamera oqimidan kelgan har bir kadr uchun chaqiriladi: yuzni
  /// aniqlaydi va natijani sof-mantiqli [onDetection]ga uzatadi.
  ///
  /// Faqat qurilmada ishlaydi (`CameraImage` → `InputImage` konvertatsiya
  /// native baytlarga bog'liq) — shuning uchun unit testda emas.
  Future<void> onFrame(CameraImage image) async {
    // Birinchi kadr keldi — bog'lanish MUVAFFAQIYATLI: jim-bog'lanish
    // qo'riqchisini bekor qilamiz (aks holda u 3s da keraksiz qayta-bog'lanish
    // boshlab yuborardi). `_busy`/`_detecting`dan OLDIN.
    if (!_firstFrameReceived) {
      _firstFrameReceived = true;
      _bindWatchdog?.cancel();
    }
    // Aniqlash KETMA-KET: oldingi `detect()` (ML Kit `processImage`) tugamasdan
    // yangisi boshlansa, ML Kit parallel so'rovni qo'llab-quvvatlamay jimgina
    // xato beradi — aniqlash "bir ishlab, bir ishlamaydigan" bo'lib qoladi.
    if (_finished || _busy || _detecting) return;
    _detecting = true;
    _lastImage = image;
    // ML Kit `boundingBox`ni `rotation` QO'LLANGANDAN keyingi (tik) koordinata
    // tizimida qaytaradi — old kamera sensori odatda 90°/270°, bu holda tik
    // tasvirning eni/bo'yi XOM kadrga nisbatan ALMASHGAN. Sifat-gate bbox
    // markazini `_frameSize` markaziga solishtirgani uchun `_frameSize` ham
    // AYNAN shu tik o'lchamda bo'lishi shart — aks holda "markaz" noto'g'ri
    // o'qqa nisbatan hisoblanib, chapga/o'ngga/pastga ko'rsatmalari noto'g'ri
    // joyda ishlaydi (worker_app `FaceCubit.onFrame` bilan bir xil tuzatish).
    final rotatedQuarter =
        _rotation == InputImageRotation.rotation90deg ||
        _rotation == InputImageRotation.rotation270deg;
    _frameSize = rotatedQuarter
        ? Size(image.height.toDouble(), image.width.toDouble())
        : Size(image.width.toDouble(), image.height.toDouble());
    try {
      final face = await _detector.detect(image, _rotation);
      onDetection(face);
    } on Object {
      // Bitta noto'g'ri/parslanmaydigan kadr butun oqimni to'xtatmasin —
      // keyingi kadr qayta urinadi.
    } finally {
      _detecting = false;
    }
  }

  // ================ Sof mantiq: sifat-gate (unit-testable) ================

  /// Sintetik yoki haqiqiy `DetectedFace`ni sifat-gate holat mashinasiga
  /// uzatadi. Butun `FaceCubit` testlari shu metodni to'g'ridan-to'g'ri
  /// chaqiradi — kamera/model/qurilmaga bog'liqlik yo'q.
  @visibleForTesting
  void onDetection(DetectedFace? face) {
    if (_finished || _busy) return;
    _lastFace = face;

    if (face == null) {
      _stableSince = null;
      emit(const FaceSearching());
      return;
    }

    final reason = _evaluateQuality(face);
    if (reason != null) {
      _stableSince = null;
      emit(FacePoorQuality(reason));
      return;
    }

    final now = _clock();
    _stableSince ??= now;
    final progress = _progressAt(now);

    if (progress >= 1) {
      emit(const FaceAligning(1));
      unawaited(capture());
    } else {
      emit(FaceAligning(progress));
    }
  }

  double _progressAt(DateTime now) {
    final totalMs = _stableDuration.inMilliseconds;
    if (totalMs <= 0) return 1;
    final elapsedMs = now.difference(_stableSince!).inMilliseconds;
    if (elapsedMs <= 0) return 0;
    if (elapsedMs >= totalMs) return 1;
    return elapsedMs / totalMs;
  }

  /// Sifat gate: yuz markazda + yetarlicha yaqin/uzoq emas + boshi
  /// to'g'ri + ko'zlari ochiq bo'lsa `null` (OK) qaytaradi, aks holda
  /// birinchi buzilgan shartga mos sababni qaytaradi.
  PoorQualityReason? _evaluateQuality(DetectedFace face) {
    final box = face.boundingBox;
    final signal = face.signal;

    final frameMin = math.min(_frameSize.width, _frameSize.height);
    if (frameMin > 0) {
      final relativeSize = math.min(box.width, box.height) / frameMin;
      if (relativeSize < _minFaceRelativeSize) {
        return PoorQualityReason.tooFar;
      }
      if (relativeSize > _maxFaceRelativeSize) {
        return PoorQualityReason.tooClose;
      }
    }

    if (_frameSize.width > 0 && _frameSize.height > 0) {
      final center = box.center;
      // SIGNED endi (avvalgi `.abs()` faqat chegarani tekshirar edi) —
      // ikkala o'q ham chegaradan oshsa, KATTAROQ nisbatdagisi bitta
      // yo'nalishli ko'rsatma tanlaydi (bir vaqtda ikkita qarama-qarshi
      // ko'rsatma ko'rsatilmaydi).
      final dx = center.dx - _frameSize.width / 2;
      final dy = center.dy - _frameSize.height / 2;
      final dxFraction = dx.abs() / _frameSize.width;
      final dyFraction = dy.abs() / _frameSize.height;

      if (dxFraction > _maxCenterOffsetFraction ||
          dyFraction > _maxCenterOffsetFraction) {
        if (dxFraction >= dyFraction) {
          // Oyna (mirror) tuzatishi — qarang: worker_app'dagi
          // `FaceCubit._evaluateQuality` va `PoorQualityReason.moveLeft`
          // hujjatidagi to'liq izoh (bir xil old-kamera + bir xil
          // oynalash shartnomasi, faqat bu yerda enrollment-only).
          return dx > 0
              ? PoorQualityReason.moveRight
              : PoorQualityReason.moveLeft;
        } else {
          // Vertikal o'qda oyna YO'Q — xom `dy` ekrandagi/tanaga nisbiy
          // yo'nalish bilan to'g'ridan-to'g'ri mos keladi.
          return dy > 0 ? PoorQualityReason.moveUp : PoorQualityReason.moveDown;
        }
      }
    }

    final eulerY = signal.headEulerY;
    if (eulerY != null && eulerY.abs() >= _maxHeadEulerDegrees) {
      return PoorQualityReason.turned;
    }

    final leftEye = signal.leftEye;
    final rightEye = signal.rightEye;
    final eyesClosed =
        (leftEye != null && leftEye <= _minEyeOpenProbability) ||
        (rightEye != null && rightEye <= _minEyeOpenProbability);
    if (eyesClosed) return PoorQualityReason.eyesClosed;

    return null;
  }

  // ================= Qurilma-only: capture pipeline =================

  /// Sifat gate 1.5s barqaror bo'lgach avtomatik chaqiriladi: joriy
  /// kadrni bbox bo'yicha 112x112ga kesadi, embedding hisoblaydi va
  /// `EnrollFace` orqali saqlaydi. Har bir bosqich xatosi ushlanadi va
  /// "Qayta urinish" bilan qayta urinsa bo'ladigan `FaceError`ga
  /// aylanadi.
  Future<void> capture() async {
    if (_busy || _finished) return;
    _busy = true;
    emit(const FaceCapturing());

    final image = _lastImage;
    final face = _lastFace;
    if (image == null || face == null) {
      // Sof-mantiq testlarida (yoki nazariy race holatida) haqiqiy kadr
      // hali mavjud emas — productionda `onFrame` har doim `_lastImage`ni
      // `onDetection`dan oldin o'rnatgani uchun bu yo'l amalda
      // chaqirilmaydi, lekin baribir nazokat bilan qaytariladi.
      _busy = false;
      _stableSince = null;
      emit(const FaceError("Kadr topilmadi. Qaytadan urinib ko'ring."));
      return;
    }

    try {
      final rgb112 = _cropTo112(image, face.boundingBox);

      // Best-effort: skanerlangan yuzni profil avatari uchun JPG sifatida
      // saqlaymiz. Rasm IXTIYORIY — saqlash muvaffaqiyatsiz bo'lsa ham
      // (`saveRgb` `null` qaytaradi, uncaught yo'q) ro'yxatdan o'tkazish
      // davom etadi. Qurilma-only (real kadr piksellari) — `FaceEmbedder`
      // bilan bir xil pretsedent, shuning uchun unit-testda emas.
      final photoStore = _facePhotoStore;
      if (photoStore != null) {
        unawaited(photoStore.saveRgb(rgb112, size: kFaceInputSize));
      }

      emit(const FaceEmbedding());
      if (!_embedderLoaded) {
        await _embedder.load();
        _embedderLoaded = true;
      }
      final embedding = _embedder.embed(rgb112);

      emit(const FaceEnrolling());
      final template = FaceTemplate(
        embedding: embedding,
        enrolledAt: DateTime.now(),
        ownerId: _ownerId,
      );
      final result = await _enrollFace(EnrollFaceParams(template));
      result.fold(
        (failure) {
          _busy = false;
          _stableSince = null;
          emit(FaceError(failure.message));
        },
        (_) {
          _finished = true;
          emit(const FaceSuccess());
        },
      );
    } on Object catch (e) {
      _busy = false;
      _stableSince = null;
      emit(FaceError("Ro'yxatdan o'tkazishda xatolik: $e"));
    }
  }

  /// Umumiy xatodan keyin jonli aniqlashni davom ettiradi — kamerani
  /// qayta ishga tushirmaydi (u hali ham ishlab turibdi), faqat gate
  /// holatini tiklaydi.
  void retry() {
    if (_finished) return;
    _busy = false;
    _stableSince = null;
    emit(const FaceSearching());
  }

  // ================= Qurilma-only: 112x112 RGB kesish =================

  Uint8List _cropTo112(CameraImage image, Rect box) {
    var decoded = Platform.isIOS
        ? _bgraToImage(image)
        : (image.planes.length >= 3
              ? _yuv420ToImage(image)
              : _nv21ToImage(image));

    // Xom kadr sensor (yotiq) orientatsiyada — ML Kit bbox esa `rotation`
    // qo'llangan (tik) koordinatada. Rasmni tik holatga aylantiramiz: bbox
    // kesimi to'g'ri tushadi va saqlangan profil rasmi 90° yotib qolmaydi
    // (enroll va verify bir xil shu metoddan o'tadi).
    final rotationDeg = switch (_rotation) {
      InputImageRotation.rotation90deg => 90,
      InputImageRotation.rotation180deg => 180,
      InputImageRotation.rotation270deg => 270,
      InputImageRotation.rotation0deg => 0,
    };
    if (rotationDeg != 0) {
      decoded = img.copyRotate(decoded, angle: rotationDeg);
    }

    final left = _clampInt(box.left, 0, decoded.width - 1);
    final top = _clampInt(box.top, 0, decoded.height - 1);
    final right = _clampInt(box.right, left + 1, decoded.width);
    final bottom = _clampInt(box.bottom, top + 1, decoded.height);

    final cropped = img.copyCrop(
      decoded,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    );
    final resized = img.copyResize(
      cropped,
      width: kFaceInputSize,
      height: kFaceInputSize,
      interpolation: img.Interpolation.linear,
    );
    return _toRgbBytes(resized);
  }

  img.Image _bgraToImage(CameraImage image) {
    final plane = image.planes.first;
    return img.Image.fromBytes(
      width: image.width,
      height: image.height,
      bytes: plane.bytes.buffer,
      bytesOffset: plane.bytes.offsetInBytes,
      rowStride: plane.bytesPerRow,
      order: img.ChannelOrder.bgra,
      numChannels: 4,
    );
  }

  /// Android NV21 (Y-plane + interleaved VU-plane) baytlarini RGB
  /// `img.Image`ga qo'lda dekodlaydi.
  img.Image _nv21ToImage(CameraImage image) {
    final width = image.width;
    final height = image.height;
    final plane = image.planes.first;
    final bytes = plane.bytes;
    // MUHIM: Y planе qator uzunligi `width` EMAS, `bytesPerRow` (stride) —
    // qatorlar orasidagi to'ldirish (padding) hisobga olinmasa rasm diagonal
    // qiyshayadi. VU (interleaved) planе Y'dan keyin bir xil stride bilan.
    final rowStride = plane.bytesPerRow;
    final ySize = rowStride * height;
    final out = img.Image(width: width, height: height);

    for (var row = 0; row < height; row++) {
      for (var col = 0; col < width; col++) {
        final y = bytes[row * rowStride + col] & 0xff;
        final uvIndex = ySize + (row >> 1) * rowStride + (col >> 1) * 2;
        if (uvIndex + 1 >= bytes.length) continue;
        final v = bytes[uvIndex] & 0xff;
        final u = bytes[uvIndex + 1] & 0xff;

        final yD = y - 16;
        final uD = u - 128;
        final vD = v - 128;

        final r = _clampByte((1.164 * yD + 1.596 * vD).round());
        final g = _clampByte((1.164 * yD - 0.392 * uD - 0.813 * vD).round());
        final b = _clampByte((1.164 * yD + 2.017 * uD).round());

        out.setPixelRgb(col, row, r, g, b);
      }
    }
    return out;
  }

  /// `yuv420_888` (Y + alohida U/V) kadrini RGB `img.Image`ga dekodlaydi —
  /// plane stride/pixelStride hisobga olinadi. Kamera endi `yuv420` formatida
  /// ishlaydi (qarang: `startCamera`).
  img.Image _yuv420ToImage(CameraImage image) {
    final width = image.width;
    final height = image.height;
    final yPlane = image.planes[0];
    final uPlane = image.planes[1];
    final vPlane = image.planes[2];
    final yRowStride = yPlane.bytesPerRow;
    final uvRowStride = uPlane.bytesPerRow;
    final uvPixelStride = uPlane.bytesPerPixel ?? 1;
    final out = img.Image(width: width, height: height);

    for (var row = 0; row < height; row++) {
      final yRow = row * yRowStride;
      final uvRow = (row >> 1) * uvRowStride;
      for (var col = 0; col < width; col++) {
        final y = yPlane.bytes[yRow + col] & 0xff;
        final uvCol = (col >> 1) * uvPixelStride;
        if (uvRow + uvCol >= uPlane.bytes.length ||
            uvRow + uvCol >= vPlane.bytes.length) {
          continue;
        }
        final u = uPlane.bytes[uvRow + uvCol] & 0xff;
        final v = vPlane.bytes[uvRow + uvCol] & 0xff;
        final yD = y - 16;
        final uD = u - 128;
        final vD = v - 128;
        final r = _clampByte((1.164 * yD + 1.596 * vD).round());
        final g = _clampByte((1.164 * yD - 0.392 * uD - 0.813 * vD).round());
        final b = _clampByte((1.164 * yD + 2.017 * uD).round());
        out.setPixelRgb(col, row, r, g, b);
      }
    }
    return out;
  }

  Uint8List _toRgbBytes(img.Image image) {
    final out = Uint8List(kFaceInputSize * kFaceInputSize * 3);
    var i = 0;
    for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
        final pixel = image.getPixel(x, y);
        out[i++] = pixel.r.toInt();
        out[i++] = pixel.g.toInt();
        out[i++] = pixel.b.toInt();
      }
    }
    return out;
  }

  int _clampInt(double value, int min, int max) {
    final v = value.round();
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  int _clampByte(int value) => _clampInt(value.toDouble(), 0, 255);

  @override
  Future<void> close() async {
    _finished = true;
    _bindWatchdog?.cancel();
    final controller = _controller;
    if (controller != null) {
      try {
        if (_streaming) {
          await controller.stopImageStream();
        }
        await controller.dispose();
      } on Object {
        // Yopilayotganda — jim o'tkazib yuboriladi.
      }
    }
    try {
      await _detector.dispose();
    } on Object {
      // Yopilayotganda — jim o'tkazib yuboriladi.
    }
    return super.close();
  }
}
