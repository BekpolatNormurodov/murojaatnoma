import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:app_core/app_core.dart';
import 'package:camera/camera.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/face/data/services/face_detector_service.dart';
import 'package:worker_app/features/face/data/services/face_embedder.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';
import 'package:worker_app/features/face/domain/services/liveness_controller.dart';
import 'package:worker_app/features/face/domain/usecases/enroll_face.dart';
import 'package:worker_app/features/face/domain/usecases/verify_face.dart';

part 'face_state.dart';

/// Bir martalik geofence tekshiruvi natijasi — jonli "Ish hududidasiz /
/// tashqaridasiz" banneri uchun. `FaceState`dan ATAYLAB mustaqil: bu
/// banner asosiy pipeline (`FaceState`) bilan BIR VAQTDA, unga ustma-ust
/// tushmasdan ko'rsatiladi (masalan `livenessPrompt` davomida ham banner
/// ko'rinib turadi) — shuning uchun sealed `FaceState` ierarxiyasining bir
/// qismi EMAS, oddiy qiymat-klass.
@immutable
class GeofenceStatus {
  const GeofenceStatus._(this.isInside, this.distanceMeters);

  /// Joylashuv aniqlandi va ish hududi ichida.
  const GeofenceStatus.inside(double distanceMeters)
    : this._(true, distanceMeters);

  /// Joylashuv aniqlandi va ish hududidan tashqarida.
  const GeofenceStatus.outside(double distanceMeters)
    : this._(false, distanceMeters);

  /// Joylashuvni aniqlab bo'lmadi (ruxsat yo'q/xizmat o'chirilgan/xato) —
  /// banner neytral ko'rinishda qoladi, hech qachon uncaught bo'lmaydi.
  const GeofenceStatus.unknown() : this._(null, null);

  /// `null` — hali aniqlanmagan/xato; aks holda ichkarida/tashqarida.
  final bool? isInside;

  /// Ish joyi markazigacha bo'lgan masofa (metr) — `isInside == null`
  /// bo'lsa ham `null`.
  final double? distanceMeters;
}

/// Yuzni ro'yxatdan o'tkazish (enrollment, Vazifa 16) VA kunlik yuz bilan
/// check-in (liveness + match + davomat, Vazifa 17) oqimlarini boshqaruvchi
/// Cubit.
///
/// Ikki mustaqil "rejim" bitta klassda birlashtirilgan — kamera
/// hayot-sikli (`startCamera`/`pauseCamera`/`resumeCamera`/`close`), 112x112
/// kesish va sifat-gate infratuzilmasi ikkalasi uchun ham bitta marta
/// yozilgan (Vazifa 17 uni QAYTA ISHLATADI, nusxa olmaydi). Rejim
/// [startLiveness] chaqirilganidan keyin `onFrame`ning ichki tarmog'ida
/// (`_livenessMode`) tanlanadi — bitta `FaceCubit` instansi FAQAT bitta
/// sahifa (enroll YOKI checkin) uchun yaratiladi (`getIt<FaceCubit>()`),
/// shuning uchun bu rejim hech qachon "ikkalasi ham" bo'lib qolmaydi.
///
/// Har ikkala rejim ham BITTA umumiy qatlamlanishga amal qiladi:
/// - **Qurilma-only**: kamera oqimi, ML Kit, TFLite, fayl I/O,
///   geolocator/permission chaqiruvlari — faqat haqiqiy qurilmada
///   tekshiriladi (`onFrame`, `capture`, `_captureAndVerify`,
///   `_saveScreenshot`, `_defaultLocate`).
/// - **Sof mantiq**: hech qanday Flutter/kamera/model/tarmoq chaqiruvisiz
///   ishlaydi, shuning uchun unit-testda to'liq tekshiriladi:
///   [onDetection] (enrollment sifat-gate), [onLivenessFrame] (liveness
///   progress) va [verifyAndCheckIn] (post-liveness qaror-mantiq — Vazifa
///   17ning asosiy testable "seam"i: `VerifyFace`/`CheckIn`/`locate` inject
///   qilingan, shuning uchun sintetik `probe` embedding bilan haqiqiy
///   kamera/fayl tizimisiz to'liq ishlaydi).
///
/// **Barqarorlik vaqti clock'i**: `stableDuration` va `clock` konstruktor
/// orqali inject qilinadi (ikkinchisi standart holatda `DateTime.now`).
/// Bu — brifda taklif qilingan ikki variantdan (inject qilingan
/// davomiylik yoki inject qilingan soat) soddarog'i: haqiqiy vaqt farqini
/// (`clock().difference(...)`) hisoblaymiz, testlarda esa `clock` orqali
/// vaqtni real kutishsiz, qo'lda "oldinga suramiz" — natijada test
/// tezkor va deterministik, productionda esa progress kamera kadr
/// tezligidan mustaqil, haqiqiy o'tgan vaqtga asoslanadi. `livenessTimeout`
/// (standart 20s) xuddi shu `clock`dan foydalanadi — liveness challenge
/// uchun alohida `Timer` YO'Q, kadr kelishi bilan elapsed vaqt tekshiriladi
/// (kamera ~15-30fps uzluksiz kadr bergani uchun productionda ishonchli,
/// testda esa `clock`ni "oldinga surish" bilan real kutishsiz tekshiriladi).
class FaceCubit extends Cubit<FaceState> {
  FaceCubit({
    required FaceDetectorService detector,
    required FaceEmbedder embedder,
    required EnrollFace enrollFace,
    required VerifyFace verifyFace,
    required CheckIn checkIn,
    required GeofenceService geofence,
    required String workerId,
    FacePhotoStore? facePhotoStore,
    Duration stableDuration = const Duration(milliseconds: 900),
    Duration livenessTimeout = const Duration(seconds: 20),
    DateTime Function() clock = DateTime.now,
    Future<Position> Function() locate = _defaultLocate,
  }) : _detector = detector,
       _embedder = embedder,
       _enrollFace = enrollFace,
       _verifyFace = verifyFace,
       _checkIn = checkIn,
       _geofence = geofence,
       _workerId = workerId,
       _facePhotoStore = facePhotoStore,
       _stableDuration = stableDuration,
       _livenessTimeout = livenessTimeout,
       _clock = clock,
       _locate = locate,
       super(const FaceInitializing());

  final FaceDetectorService _detector;
  final FaceEmbedder _embedder;
  final EnrollFace _enrollFace;
  final VerifyFace _verifyFace;
  final CheckIn _checkIn;
  final GeofenceService _geofence;
  final String _workerId;

  /// Enrollment paytida skanerlangan yuz kadrini profil avatari uchun
  /// saqlovchi (ixtiyoriy — `null` bo'lsa rasm saqlanmaydi, ro'yxatdan
  /// o'tkazish o'zgarishsiz davom etadi). Best-effort, qurilma-only —
  /// `user_app/features/face/presentation/bloc/face_cubit.dart` bilan bir
  /// xil pretsedent.
  final FacePhotoStore? _facePhotoStore;
  final Duration _stableDuration;
  final Duration _livenessTimeout;
  final DateTime Function() _clock;
  final Future<Position> Function() _locate;

  /// `onFrame` hali chaqirilmagan bo'lsa (masalan sof-mantiq testlarida)
  /// sifat-gate shu kadr o'lchamini faraz qiladi. Qurilmada birinchi
  /// haqiqiy kadr kelishi bilan darhol haqiqiy o'lchamga yangilanadi.
  static const _defaultFrameSize = Size(1280, 720);

  // ---- Sifat-gate chegaralari (real qurilmada tekshirilgan: markazda +
  // kattalik + |eulerY|<20 + ko'z ochiq>0.3) ----
  //
  // Ko'rib chiqish (real-device UX bug): dastlabki qiymatlar (0.28/0.16/12/
  // 0.4) haqiqiy old kamera kadrlarida deyarli hech qachon bajarilmasdi —
  // (a) `_maxCenterOffsetFraction` FRAME markaziga nisbatan hisoblanadi,
  // lekin yuz-siluet overlay (avval `FaceOvalOverlay`, endi
  // `app_ui`dagi `FaceScanOverlay._faceRect`) siluetni `size.height * 0.42`da
  // (frame markazi EMAS — ikkalasida ham BIR XIL nisbat) chizadi, shuning
  // uchun foydalanuvchi yuzni RAMKAGA to'g'ri joylashtirsa ham gate uni
  // "markazda emas" deb belgilardi; (b) haqiqiy old-kamera kadrlarida yuz
  // bbox'i kutilganidan kichikroq (uzoqroq tutilgan telefon, keng burchak
  // linza); (c) odamlar mukammal frontal tik turmaydi. Quyidagi qiymatlar
  // shu uch muammoni birga hal qiladi — markazlashtirilgan, frontalga
  // yaqin yuz endi ISHONCHLI ravishda "aligning"ga o'tib, muvaffaqiyatli
  // tugaydi.
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
  var _busy = false;
  var _finished = false;

  /// **Jim-bog'lanish (silent-bind) qo'riqchisi.** Ba'zi qurilmalarda
  /// (Vivo/legacy old kamera) CameraX Preview + ImageCapture + ImageAnalysis
  /// (3 ta surface) kombinatsiyasini bog'lay olmaydi — va bu xato
  /// `startImageStream()` future'i ALLAQACHON muvaffaqiyatli qaytgandan
  /// KEYIN, ASINXRON tarzda (`_configureImageAnalysis` ichida) otiladi.
  /// Shu bois `startImageStream`ni `try/catch`ga o'rash uni USHLAMAYDI:
  /// oqim jim o'ladi, bironta ham kadr kelmaydi va ekran abadiy
  /// `FaceSearching`da qotib qoladi ("apk da aniqlamaydi"). Qo'riqchi:
  /// oqim boshlangach 3 soniya ichida BIRINCHI kadr kelmasa, bog'lanish
  /// jim muvaffaqiyatsiz bo'lgan deб hisoblaymiz va YANGI kontroller bilan
  /// qayta bog'lanamiz (bog'lanish intermitent — qayta urinishda odatda
  /// ochiladi; shu tufayli `flutter run`da "bir iwlab" ketardi). Birinchi
  /// kadr kelishi bilan (`onFrame`) darhov bekor qilinadi.
  Timer? _bindWatchdog;
  var _firstFrameReceived = false;
  var _bindAttempts = 0;
  static const _maxBindAttempts = 5;

  /// `onFrame` ichida bitta `detect()` faol bo'lganda `true` — kadrlarni
  /// ketma-ket qayta ishlash uchun (ML Kit `processImage`ni parallel
  /// chaqirib bo'lmaydi — qarang: `onFrame` izohi).
  var _detecting = false;

  // ---- Vazifa 17: liveness/check-in rejimi ----

  /// `startLiveness()` chaqirilganidan beri `true` — `onFrame` shu
  /// bayroq orqali enrollment sifat-gate ([onDetection]) bilan liveness
  /// ([onLivenessFrame]) o'rtasida tanlaydi. Bitta `FaceCubit` instansi
  /// faqat bitta sahifa uchun yaratilgani sababli, marta o'rnatilgach
  /// hech qachon qaytarilmaydi.
  var _livenessMode = false;
  LivenessController? _livenessController;
  List<LivenessAction> _livenessActions = const [];
  DateTime? _livenessStartedAt;

  /// Ko'rib chiqish tuzatishi (Fix 1): joriy urinish uchun capture
  /// ALLAQACHON ishga tushirilganini bildiradi — `true` bo'lgach
  /// `onLivenessFrame`/`onNoFace` (demak, timeout ham) va `onFrame`ning
  /// qayta-trigger tekshiruvi ([canTriggerCapture]) darhol no-op bo'lib
  /// qoladi, toki [startLiveness] yoki [retry] YANGI urinish boshlamaguncha.
  /// Buning yo'qligi — `matchFailed`/`geofenceOutside`/`FaceError`dan
  /// keyin ham kamera kadrlari kelaverishi sababli `_livenessController`
  /// `isComplete` bo'lib qolaverishi va HAR safar qayta capture/verify/
  /// checkIn ishga tushirib, ustma-ust (barrierDismissible:false) dialog
  /// va takroriy tarmoq so'rovlariga olib kelishi mumkin edi.
  var _captureConsumed = false;

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
        // Android: `yuv420` — qurilma tabiiy qo'llaydigan image-analysis
        // formati (`nv21` majburlansa ba'zi qurilmalarda oqim umuman
        // ochilmasdi). Detektor/`_cropTo112` yuv420 (3 tekislik) ni ham
        // qabul qiladi.
        imageFormatGroup: Platform.isIOS
            ? ImageFormatGroup.bgra8888
            : ImageFormatGroup.yuv420,
      );
      await controller.initialize();
      // Ekran DOIM portret — jonli, beqaror `deviceOrientation`ga
      // tayanmaslik uchun aylanishni qattiq portretga mahkamlaymiz.
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
  /// yo'qolgan bo'lsa (masalan uzoq fon rejimidan keyin OS uni tozalagan
  /// bo'lsa), to'liq qayta ishga tushiradi.
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
  /// aniqlaydi va joriy rejimga qarab natijani sof-mantiqli
  /// [onDetection] (enrollment) yoki [onLivenessFrame]/[onNoFace]
  /// (check-in)ga uzatadi — kamera hayot-sikli ikkala rejim uchun ham
  /// BITTA (Vazifa 16'dan qayta ishlatiladi, nusxalanmaydi).
  ///
  /// Fix 1 (ko'rib chiqish): capture trigger'i ENDI [canTriggerCapture]
  /// orqali tekshiriladi va — TRIGGER PAYTIDA, crop/embeddan OLDIN —
  /// `_captureConsumed = true` qilib qo'yiladi. Shu tufayli: (a) bir
  /// urinishda capture FAQAT bir marta ishga tushadi (avvalgi holatda
  /// `_livenessController.isComplete` doim `true` bo'lib qolgani uchun
  /// HAR bir keyingi kadr qayta capture/verify/checkIn'ni ishga
  /// tushirib, ustma-ust dialog va takroriy so'rovlarga olib kelardi);
  /// (b) crop/embed o'zi istisno tashlab qolsa ham (ya'ni
  /// `_captureAndVerify` hali ishlay boshlamagan yoki yarimda
  /// to'xtagan bo'lsa ham) qayta-urinish tsikli boshlanmaydi.
  ///
  /// Faqat qurilmada ishlaydi (`CameraImage` → `InputImage` konvertatsiya
  /// native baytlarga bog'liq) — shuning uchun unit testda emas.
  Future<void> onFrame(CameraImage image) async {
    // Birinchi kadr keldi — bog'lanish MUVAFFAQIYATLI: jim-bog'lanish
    // qo'riqchisini bekor qilamiz (aks holda u 3s da keraksiz qayta-bog'lanish
    // boshlab yuborardi). `_busy`/`_detecting`dan OLDIN, чунки kadr kelgani
    // o'zi bog'lanish ishlaganini bildiradi.
    if (!_firstFrameReceived) {
      _firstFrameReceived = true;
      _bindWatchdog?.cancel();
    }
    // MUHIM: aniqlash KETMA-KET bo'lishi shart — oldingi `detect()` (ML Kit
    // `processImage`) tugamasdan yangisi boshlansa, ML Kit bir vaqtda ikkita
    // so'rovni qo'llab-quvvatlamay jimgina xato beradi va aniqlash "bir
    // ishlab, bir ishlamaydigan" (uzuq-yuluq) bo'lib qoladi. `_detecting`
    // bayrog'i shu kadrni tashlab, faqat bitta detect faol bo'lishini
    // kafolatlaydi (kamera oqimi 15-30fps — tashlangan kadr sezilmaydi).
    if (_finished || _busy || _detecting) return;
    _detecting = true;
    _lastImage = image;
    // MUHIM: ML Kit `boundingBox`ni `rotation` QO'LLANGANDAN keyingi (tik/
    // upright) koordinata tizimida qaytaradi. Old kamerada sensor
    // orientatsiyasi odatda 90°/270° — bu holda tik tasvirning eni/bo'yi
    // XOM kadrga nisbatan ALMASHGAN bo'ladi. Sifat-gate ([_evaluateQuality])
    // bbox markazini `_frameSize` markaziga solishtirgani uchun, `_frameSize`
    // ham AYNAN shu (bbox bilan bir xil) tik koordinata o'lchamida bo'lishi
    // shart — aks holda "markaz" noto'g'ri o'qqa nisbatan hisoblanib,
    // chapga/o'ngga/pastga/yuqoriga ko'rsatmalari noto'g'ri joyda ishlaydi.
    final rotatedQuarter =
        _rotation == InputImageRotation.rotation90deg ||
        _rotation == InputImageRotation.rotation270deg;
    _frameSize = rotatedQuarter
        ? Size(image.height.toDouble(), image.width.toDouble())
        : Size(image.width.toDouble(), image.height.toDouble());
    try {
      final face = await _detector.detect(image, _rotation);
      if (_livenessMode) {
        if (face != null) {
          // Bbox faqat qurilma-only [_captureAndVerify] uchun kerak —
          // sof [onLivenessFrame] esa faqat `FaceSignal` bilan ishlaydi.
          _lastFace = face;
          onLivenessFrame(face.signal);
          if (canTriggerCapture) {
            _captureConsumed = true;
            unawaited(_captureAndVerify());
          }
        } else {
          onNoFace();
        }
      } else {
        onDetection(face);
      }
    } on Object {
      // Bitta noto'g'ri/parslanmaydigan kadr butun oqimni to'xtatmasin —
      // keyingi kadr qayta urinadi ("hech qachon uncaught" mandati shu
      // yerda ham qo'llanadi, lekin bitta kadr xatosi UI holatini
      // buzmasligi kerak).
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
    if (kDebugMode) {
      debugPrint(
        'FACE gate: reason=$reason box=${face.boundingBox} frame=$_frameSize',
      );
    }
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
  ///
  /// `headEulerZ` hozircha `FaceSignal`da mavjud emas (faqat `headEulerY`
  /// bor) — Task 16 "Key decisions"ga ko'ra Z hali mavjud emas deb
  /// hisoblanadi va faqat Y bo'yicha gate qilinadi. Xuddi shunday,
  /// `lowLight` uchun hozircha yorug'lik signali yo'q — enum kelajakka
  /// tayyor saqlanadi, lekin joriy gate uni hech qachon qaytarmaydi.
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
          // **Oyna (mirror) tuzatishi — ATAYLAB TESKARI ko'rinadigan
          // shart**: [detect]/`FaceDetectorService` hujjatiga ko'ra bbox
          // markazi doim XOM (oynalanmagan) kadr koordinatasida — displey
          // esa `MirroredCameraPreview` orqali GORIZONTAL oynalangan
          // (tabiiy "oyna" ko'rinishi uchun). Old kamerada ikki tomon
          // bir-biriga QARAMA-QARSHI turgandagi kabi: foydalanuvchi O'Z
          // CHAP tomoniga siljisa, xom kadrda bbox O'NGGA (musbat `dx`)
          // siljiydi — bu aynan `LivenessController._feedTurnLeft`dagi
          // bilan BIR XIL konventsiya ("Boshingizni CHAPGA buring"
          // ko'rsatmasi `headEulerY > 25`da, ya'ni ML Kit "rasmning O'NG
          // tomoniga burilgan" deb ataydigan musbat qiymatda, bajarilgan
          // deb hisoblanadi — qarang: shu faylning tepasidagi euler-Y
          // izohi). Demak: bbox ALLAQACHON musbat `dx`da (xom kadrning
          // o'ng tomonida) bo'lsa, foydalanuvchi O'ZINI O'NGGA surishi
          // kerak (aks holda chapga surilsa `dx` yanada oshib ketardi);
          // manfiy `dx`da esa aksincha, CHAPGA.
          return dx > 0
              ? PoorQualityReason.moveRight
              : PoorQualityReason.moveLeft;
        } else {
          // Vertikal o'qda oyna YO'Q (`MirroredCameraPreview` faqat X'ni
          // flip qiladi) — xom `dy` ekrandagi/tanaga nisbiy yo'nalish
          // bilan to'g'ridan-to'g'ri mos keladi: bbox markazi kadr
          // markazidan PASTDA (musbat `dy`) bo'lsa, foydalanuvchi
          // YUQORIROQ tutishi kerak.
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

  // ========= Vazifa 17: liveness (sof mantiq, unit-testable seam) =========

  /// Kunlik check-in liveness challenge'ini sozlaydi — SOF metod: hech
  /// qanday kamera/ruxsat/model chaqiruviga tegmaydi, shuning uchun
  /// haqiqiy qurilma plaginlarisiz to'liq unit-testlanadi. Sahifa buni
  /// `startCamera()` bilan BIRGA (ikkalasi ham, mustaqil) chaqiradi —
  /// qarang: `FaceCheckinPage.initState`.
  ///
  /// [actions] — sahifa tomonidan deterministik tanlangan 2-3 ta
  /// `LivenessAction` (test esa aniq ro'yxat beradi).
  ///
  /// Fix 2 (ko'rib chiqish): timeout soati SHU YERDA, darhol, o'rnatiladi
  /// — birinchi aniqlangan yuz kadrigacha KUTILMAYDI. Aks holda, agar
  /// foydalanuvchi umuman kadrga to'g'ri kelmasa (yorug'lik/burchak/joy),
  /// timeout hech qachon "qurollanmagan" bo'lib qolaverar va
  /// `FaceLivenessFailed` HECH QACHON emit qilinmas edi — foydalanuvchi
  /// `FaceSearching()`da abadiy qolib ketardi.
  void startLiveness(List<LivenessAction> actions) {
    _livenessMode = true;
    _livenessActions = actions;
    _livenessController = LivenessController(actions);
    _livenessStartedAt = _clock();
    _captureConsumed = false;
    _finished = false;
    _busy = false;
    emit(
      FaceLivenessPrompt(
        action: actions.isEmpty ? null : actions.first,
        done: 0,
        total: actions.length,
      ),
    );
  }

  /// Fix 1 (ko'rib chiqish): `onFrame` capture'ni ENDI shu getter orqali
  /// tekshiradi — challenge tugagan (`isComplete`), capture hali BIR
  /// MARTA ham ishga tushirilmagan (`!_captureConsumed`) va cubit
  /// umuman tugallanmagan bo'lsagina `true`. `onFrame` trigger paytida
  /// (crop/embeddan OLDIN) `_captureConsumed`ni `true`ga o'rnatadi —
  /// shundan keyin bu getter (demak, qayta-trigger yo'li ham) YANGI
  /// urinish ([startLiveness]/[retry]) boshlanmaguncha doim `false`.
  @visibleForTesting
  bool get canTriggerCapture =>
      !_finished &&
      !_captureConsumed &&
      (_livenessController?.isComplete ?? false);

  /// Bitta kamera kadridan olingan [signal]ni `LivenessController`ga
  /// uzatadi va progressni `FaceLivenessPrompt`ga aylantiradi — Vazifa
  /// 16'ning [onDetection] presedentiga to'liq mos: qurilma/model/tarmoq
  /// chaqiruvisiz ishlaydi, shuning uchun `face_checkin_cubit_test.dart`da
  /// sintetik `FaceSignal` qiymatlari bilan to'liq unit-test qilinadi.
  ///
  /// **Qasddan qilingan ajratish**: bu metod challenge tugagach (`isComplete`)
  /// ENDI o'zi keyingi (qurilma-only) bosqichni ishga tushirmaydi — buni
  /// FAQAT device-only [onFrame] qiladi (`isComplete` bo'lsa
  /// `_captureAndVerify()`ni chaqiradi). Aks holda, test to'g'ridan-to'g'ri
  /// shu metodni chaqirib challenge'ni tugatganda, `_lastImage` hali `null`
  /// bo'lgani uchun `_captureAndVerify` avtomatik ishga tushib, kutilmagan
  /// oraliq `FaceError` holatini chiqarib yuborar edi — bu esa aynan brif
  /// talab qilgan "sof qaror-mantiq (`verifyAndCheckIn`) alohida, aniq
  /// probe bilan chaqiriladi" seamini buzardi.
  ///
  /// `_captureConsumed` (Fix 1) tekshiruvi ham shu yerda: capture
  /// allaqachon ishga tushirilgan bo'lsa (masalan `matchFailed`dan keyin
  /// kamera hali kadr berishda davom etayotgan bo'lsa), bu metod —
  /// demak, undagi timeout tekshiruvi ham — no-op bo'ladi; aks holda
  /// foydalanuvchi allaqachon ko'rib turgan xato dialogi ustiga
  /// "muddati tugadi" dialogi qo'shilib ketishi mumkin edi.
  @visibleForTesting
  void onLivenessFrame(FaceSignal signal) {
    final controller = _livenessController;
    if (_finished || _busy || _captureConsumed || controller == null) return;
    if (_checkLivenessTimeout()) return;

    controller.feed(signal);
    final total = controller.steps.length;
    // `LivenessController.progress` (`_done/steps.length`)dan `done`ni
    // tiklaymiz — `steps.length` kichik (2-3) bo'lgani uchun suzuvchi
    // nuqta xatosi ahamiyatsiz (`.round()` har doim aniq qiymatga tushadi).
    final done = total == 0 ? 0 : (controller.progress * total).round();
    emit(
      FaceLivenessPrompt(action: controller.current, done: done, total: total),
    );
  }

  /// Fix 2 (ko'rib chiqish): joriy kadrda yuz TOPILMAGANDA (`onFrame`ning
  /// `face == null` bo'lagi) chaqiriladi. [onLivenessFrame] bilan bitta
  /// umumiy timeout tekshiruvini ([_checkLivenessTimeout]) baham ko'radi
  /// — shu tufayli muddat foydalanuvchi HECH QACHON kadrga to'g'ri
  /// kelmasa ham (masalan yorug'lik yetarli emas) baribir ishlaydi: soat
  /// [startLiveness]da darhol qurollanadi, bu yerga esa yuz
  /// aniqlanmagan HAR bir kadrda tekshiriladi.
  ///
  /// SOF: qurilma/model chaqiruvisiz ishlaydi, shuning uchun
  /// `face_checkin_cubit_test.dart`da to'g'ridan-to'g'ri (hech qachon
  /// yuz aniqlanmagan holatni ham) unit-test qilinadi.
  @visibleForTesting
  void onNoFace() {
    final controller = _livenessController;
    if (_finished || _busy || _captureConsumed || controller == null) {
      return;
    }
    if (_checkLivenessTimeout()) return;
    emit(const FaceSearching());
  }

  /// [onLivenessFrame] va [onNoFace] birgalikda ishlatadigan umumiy
  /// muddat tekshiruvi. `true` qaytarsa chaqiruvchi darhol to'xtashi
  /// kerak — `FaceLivenessFailed` allaqachon emit qilindi va
  /// `_livenessController` `null`ga o'rnatildi (shuning uchun keyingi
  /// kadrlar ushbu urinish uchun butunlay no-op bo'ladi, xuddi Fix 1'ning
  /// `_captureConsumed`i kabi — faqat [retry]/[startLiveness] tiklaydi).
  bool _checkLivenessTimeout() {
    final startedAt = _livenessStartedAt;
    if (startedAt == null) return false;
    if (_clock().difference(startedAt) < _livenessTimeout) return false;
    _livenessController = null;
    emit(const FaceLivenessFailed());
    return true;
  }

  // ================= Vazifa 17: qurilma-only capture+verify =================

  /// Liveness tugagach (`onFrame` ichida) chaqiriladi: joriy kadrni bbox
  /// bo'yicha kesadi, embedding hisoblaydi, skrinshotni saqlaydi va sof
  /// [verifyAndCheckIn]ga topshiradi. Vazifa 16'ning `capture()` metodiga
  /// o'xshab, haqiqiy kadr yo'q bo'lsa (masalan nazariy race holatida)
  /// nazokat bilan `FaceError`ga tushadi.
  Future<void> _captureAndVerify() async {
    if (_busy || _finished) return;
    final image = _lastImage;
    final face = _lastFace;
    if (image == null || face == null) {
      emit(const FaceError("Kadr topilmadi. Qaytadan urinib ko'ring."));
      return;
    }

    _busy = true;
    try {
      final rgb112 = _cropTo112(image, face.boundingBox);
      if (!_embedderLoaded) {
        await _embedder.load();
        _embedderLoaded = true;
      }
      final probe = _embedder.embed(rgb112);
      final screenshotPath = await _saveScreenshot(rgb112);
      // Haqiqiy model yuklanmagan bo'lsa (`isFallback`), moslashuvchan
      // (yumshoqroq) chegara ishlatiladi — qarang: `FaceRepository.verify`
      // hujjatlari. Solishtirishning o'zi baribir HAR DOIM haqiqiy kosinus
      // o'xshashlik orqali (hech qachon qattiq-kodlangan `passed: true`
      // emas).
      final threshold = _embedder.isFallback
          ? kFaceMatchFallbackThreshold
          : kFaceMatchThreshold;
      await verifyAndCheckIn(
        probe,
        threshold: threshold,
        screenshotPath: screenshotPath,
      );
    } on Object catch (e) {
      emit(FaceError('Tekshirishda xatolik: $e'));
    } finally {
      _busy = false;
    }
  }

  /// Kesilgan yuzni (`rgb112`) `attendance/<sana>.jpg` sifatida ilova
  /// hujjatlar papkasiga saqlaydi va to'liq yo'lni qaytaradi. Chaqiruvchi
  /// ([_captureAndVerify]) buni allaqachon `try/catch` ichida chaqiradi —
  /// fayl I/O xatosi (masalan disk to'lgan) shu orqali `FaceError`ga
  /// aylanadi, checkin YOZILMAYDI (skrinshot — davomat isboti, xato
  /// bo'lsa jim o'tkazib yuborilmaydi).
  ///
  /// Sana inject qilingan `_clock()`dan olinadi (`DateTime.now()`
  /// emas) — sinfning qolgan qismi bilan izchil (Vazifa 17 ko'rib
  /// chiqish, Minor).
  Future<String> _saveScreenshot(Uint8List rgb112) async {
    final docs = await getApplicationDocumentsDirectory();
    final folder = Directory('${docs.path}/attendance')
      ..createSync(recursive: true);
    final date = _clock().toIso8601String().split('T').first;
    final file = File('${folder.path}/$date.jpg');
    final image = img.Image.fromBytes(
      width: kFaceInputSize,
      height: kFaceInputSize,
      bytes: rgb112.buffer,
      order: img.ChannelOrder.rgb,
      numChannels: 3,
    );
    await file.writeAsBytes(img.encodeJpg(image));
    return file.path;
  }

  // ============ Vazifa 17: verify→checkin (sof qaror-mantiq seam) ============

  /// Liveness tugagach ishlatiladigan SOF qaror-mantiq: berilgan [probe]
  /// embeddingni `VerifyFace` orqali tekshiradi; mos kelsa joriy
  /// joylashuvni oladi va `CheckIn`ni chaqiradi. Har bir bosqich mos
  /// `FaceState`ga aylanadi — hech qachon uncaught qolmaydi.
  ///
  /// **Testable seam** (brifning "liveness-detection va verify/checkin
  /// mantiqini ajratish" talabi): bu metod haqiqiy kamera kadri, fayl
  /// tizimi yoki TFLite'siz TO'LIQ ishlaydi — faqat [probe] (allaqachon
  /// hisoblangan embedding — testda sintetik ro'yxat) va konstruktorda
  /// inject qilingan `VerifyFace`/`CheckIn`/`locate` (geolocator)ga
  /// bog'liq. Qurilmada buni [_captureAndVerify] chaqiradi (kamera
  /// kadridan probe/skrinshot tayyorlab); testda esa to'g'ridan-to'g'ri
  /// chaqiriladi. Haqiqiy crop/embed/skrinshot-saqlash qurilma-only bo'lib
  /// qoladi (faqat compile+analyze, unit-test qilinmaydi — brifning
  /// aniq mandati).
  ///
  /// Fix 1 (ko'rib chiqish): `_captureConsumed`ni ham shu yerda `true`ga
  /// o'rnatadi — `onFrame`dagi trigger-vaqtidagi belgilash bilan
  /// ORTIQCHA (ikkalasi ham xuddi shu bayroqni yozadi), lekin ZARARSIZ:
  /// bu nusxa aynan shu metodni TO'G'RIDAN-TO'G'RI (qurilmasiz)
  /// chaqiradigan testlar uchun [canTriggerCapture]ning to'g'ri aks
  /// etishini kafolatlaydi — `onFrame`ning o'zidagi belgilash esa
  /// crop/embed hali boshlanmasdan turib qoladi (`_captureAndVerify`
  /// o'zi chalkashib qolsa ham qayta-trigger tsikliga yo'l qo'ymaydi).
  @visibleForTesting
  Future<void> verifyAndCheckIn(
    List<double> probe, {
    double threshold = kFaceMatchThreshold,
    String screenshotPath = '',
  }) async {
    if (_finished) return;
    _captureConsumed = true;
    emit(const FaceVerifying());

    try {
      final matchEither = await _verifyFace(
        VerifyFaceParams(probe, threshold: threshold),
      );
      await matchEither.fold<Future<void>>(
        (failure) async => emit(FaceError(failure.message)),
        (match) => _afterMatch(
          match,
          probe: probe,
          screenshotPath: screenshotPath,
        ),
      );
    } on Object catch (e) {
      emit(FaceError('Yuzni tekshirishda xatolik: $e'));
    }
  }

  /// `VerifyFace` muvaffaqiyatli qaytgandan keyingi davom: mos kelmasa
  /// [FaceMatchFailed]; mos kelsa joylashuv olinib (xato bo'lsa alohida,
  /// aniqroq xabar bilan `FaceError`), `CheckIn` chaqiriladi —
  /// `Left(GeofenceFailure)` [FaceGeofenceOutside]ga, boshqa `Left`
  /// umumiy `FaceError`ga, `Right` esa [FaceCheckinSuccess]ga aylanadi.
  Future<void> _afterMatch(
    FaceMatchResult match, {
    required List<double> probe,
    required String screenshotPath,
  }) async {
    if (!match.passed) {
      emit(const FaceMatchFailed());
      return;
    }

    final Position position;
    try {
      position = await _locate();
    } on Object catch (e) {
      emit(FaceError("Joylashuvni aniqlab bo'lmadi: $e"));
      return;
    }

    emit(const FaceCheckingIn());
    final checkInEither = await _checkIn(
      CheckInParams(
        lat: position.latitude,
        lng: position.longitude,
        screenshotPath: screenshotPath,
        // Jonli backend (`useMock == false`) o'zi (>=0.7) moslikni
        // hisoblaydi — shuning uchun probe embedding + ishchi ID ham
        // yuboriladi. Mock oqimda (standart, `useMock == true`) bu ikki
        // maydon `null` qoladi: mahalliy moslik yuqorida (`_verifyFace`)
        // allaqachon tekshirilgan, backend esa umuman yo'q.
        employeeId: AppConfig.useMock ? null : _workerId,
        embedding: AppConfig.useMock ? null : probe,
      ),
    );

    checkInEither.fold(
      (failure) {
        if (failure is GeofenceFailure) {
          emit(
            FaceGeofenceOutside(
              distanceMeters: _geofence.distanceMeters(
                kWorkplaceLat,
                kWorkplaceLng,
                position.latitude,
                position.longitude,
              ),
            ),
          );
        } else {
          emit(FaceError(failure.message));
        }
      },
      (attendance) {
        _finished = true;
        emit(FaceCheckinSuccess(attendance.checkIn ?? _formattedNow()));
      },
    );
  }

  String _formattedNow() {
    final now = _clock();
    final hh = now.hour.toString().padLeft(2, '0');
    final mm = now.minute.toString().padLeft(2, '0');
    return '$hh:$mm';
  }

  // ================ Vazifa 17: jonli geofence banneri ================

  /// Kamera ekranidagi jonli geofence banneri uchun bir martalik so'rov —
  /// asosiy `FaceState` pipeline'iga TA'SIR QILMAYDI (`emit` chaqirmaydi),
  /// sahifa buni davriy (`Timer.periodic`) chaqirib natijasini o'z mahalliy
  /// widget holatida ko'rsatadi. Joylashuv xatosi/ruxsat yo'qligi
  /// [GeofenceStatus.unknown] sifatida qaytadi — hech qachon uncaught
  /// bo'lmaydi.
  Future<GeofenceStatus> checkGeofence() async {
    try {
      final position = await _locate();
      final distance = _geofence.distanceMeters(
        kWorkplaceLat,
        kWorkplaceLng,
        position.latitude,
        position.longitude,
      );
      return _geofence.isInside(position.latitude, position.longitude)
          ? GeofenceStatus.inside(distance)
          : GeofenceStatus.outside(distance);
    } on Object {
      return const GeofenceStatus.unknown();
    }
  }

  /// `locate` uchun standart (qurilma-only) implementatsiya: xizmat
  /// yoqilganini va ruxsatni tekshiradi (kerak bo'lsa so'raydi), so'ng
  /// `Geolocator.getCurrentPosition()`ni chaqiradi. Rad etilsa/xato bo'lsa
  /// aniq xabar bilan `StateError` tashlaydi — chaqiruvchilar
  /// ([_afterMatch], [checkGeofence]) buni allaqachon `try/catch` bilan
  /// ushlaydi.
  static Future<Position> _defaultLocate() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError("Joylashuv xizmati o'chirilgan");
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError('Joylashuvga ruxsat berilmagan');
    }
    return Geolocator.getCurrentPosition();
  }

  // ================= Qismi qurilma-only: capture pipeline =================

  /// Sifat gate `stableDuration` (standart 0.9s) barqaror bo'lgach
  /// avtomatik chaqiriladi: joriy
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
      // davom etadi. Qurilma-only (real kadr piksellari kerak) —
      // `FaceEmbedder` bilan bir xil pretsedent, shuning uchun unit-testda
      // emas (`user_app`dagi `FaceCubit.capture()` bilan bir xil naqsh).
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
        workerId: _workerId,
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
  ///
  /// Liveness rejimida (`FaceLivenessFailed`/`FaceMatchFailed`/
  /// `FaceGeofenceOutside`/`FaceError`dan keyin) BIR XIL harakatlar
  /// ro'yxati (`_livenessActions`) bilan yangi `LivenessController`
  /// yaratib challenge'ni boshidan boshlaydi — enrollment rejimida esa
  /// (o'zgarishsiz) sifat-gate holatini tiklaydi.
  void retry() {
    if (_finished) return;
    _busy = false;
    if (_livenessMode) {
      _livenessController = LivenessController(_livenessActions);
      _livenessStartedAt = _clock();
      _captureConsumed = false;
      emit(
        FaceLivenessPrompt(
          action: _livenessActions.isEmpty ? null : _livenessActions.first,
          done: 0,
          total: _livenessActions.length,
        ),
      );
      return;
    }
    _stableSince = null;
    emit(const FaceSearching());
  }

  // ================= Qurilma-only: 112x112 RGB kesish =================

  /// **Oynalash (mirror) shartnomasi**: [image] va [box] doim xom,
  /// oynalanmagan (`FaceDetectorService.detect()` bilan bir xil)
  /// koordinata tizimida — bu metod hech qachon piksellarni gorizontal
  /// flip qilmaydi. Bu METOD O'ZI ham [capture] (enroll, Vazifa 16) ham
  /// [_captureAndVerify] (verify, Vazifa 17) tomonidan bir xil chaqiriladi
  /// — demak, ro'yxatdan o'tishda va tekshirishda hisoblangan embedding
  /// HAR DOIM bir xil orientatsiyadagi kesimdan olinadi. Agar kelajakda
  /// bu ikkalasi orasida biror farq (masalan faqat bittasida qo'shimcha
  /// flip) paydo bo'lsa, ikki tomon endi mos kelmaydigan (bir-birining
  /// oynadagi aksi) embeddinglarni solishtiradi — bu, ayniqsa hozirgi
  /// placeholder-fallback embeddingda (`FaceEmbedder._fallbackEmbed`,
  /// piksel-pozitsiyaga bog'liq gorizontal gradient panjarasi bilan),
  /// moslikni kuchli buzadi (qarang: `assets/models/README.md`). Preview
  /// uchun "tabiiy oyna" ko'rinishi FAQAT `MirroredCameraPreview`da
  /// (render qatlami) beriladi — bu yerga hech qachon ko'chirilmasin.
  Uint8List _cropTo112(CameraImage image, Rect box) {
    var decoded = Platform.isIOS
        ? _bgraToImage(image)
        : (image.planes.length >= 3
              ? _yuv420ToImage(image)
              : _nv21ToImage(image));

    // Xom kadr sensor (yotiq) orientatsiyada — ML Kit `boundingBox`i esa
    // `rotation` QO'LLANGAN (tik) koordinatada. Rasmni ham tik holatga
    // aylantiramiz: shu bilan (a) bbox kesimi to'g'ri joyga tushadi (aniqroq
    // embedding) va (b) saqlangan profil rasmi 90° yotib qolmaydi. Enroll va
    // verify BITTA shu metoddan o'tgani uchun ikkalasi ham bir xil aylanadi.
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
  /// `img.Image`ga qo'lda dekodlaydi — `image` paketida tayyor NV21
  /// dekoder yo'q.
  img.Image _nv21ToImage(CameraImage image) {
    final width = image.width;
    final height = image.height;
    final plane = image.planes.first;
    final bytes = plane.bytes;
    // MUHIM: qatorlar orasida to'ldirish (padding) bo'lishi mumkin — Y
    // planе qator uzunligi `width` EMAS, `bytesPerRow` (stride). Ilgari
    // `width` ishlatilgani uchun stride > width bo'lgan qurilmalarda rasm
    // DIAGONAL qiyshayib ("buzuq/teskari") saqlanardi. VU (interleaved)
    // planе Y'dan keyin, bir xil stride bilan boshlanadi.
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

  /// `yuv420_888` (Y + alohida U/V tekisliklari) kadrini RGB `img.Image`ga
  /// dekodlaydi — plane stride/pixelStride hisobga olinadi. Kamera endi
  /// `yuv420` formatida ishlaydi (qarang: `startCamera`), shu bois enroll/
  /// verify kesimi shu yo'ldan o'tadi.
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
        // Yopilayotganda — jim o'tkazib yuboriladi (resurs baribir
        // qayta yaratilmaydi, cubit shu yerda umuman tugaydi).
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
