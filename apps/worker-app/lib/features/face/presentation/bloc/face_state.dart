part of 'face_cubit.dart';

/// Yuzni ro'yxatdan o'tkazish oqimidagi barcha holatlar.
///
/// `sealed` — `FaceCubit` va sahifadagi `switch` ifodalari compiler
/// tomonidan to'liq (exhaustive) tekshiriladi: yangi holat qo'shilsa,
/// uni qayerdadir unutib qoldirish kompilyatsiya xatosiga aylanadi.
sealed class FaceState extends Equatable {
  const FaceState();

  @override
  List<Object?> get props => [];
}

/// Kamera/model hali ishga tushmoqda (`startCamera()` davom etmoqda).
class FaceInitializing extends FaceState {
  const FaceInitializing();
}

/// Kamera ruxsati berilmagan.
///
/// [permanentlyDenied] — foydalanuvchi ruxsatni doimiy rad etgan bo'lsa
/// `true`: OS endi qayta so'rash oynasini ko'rsatmaydi, faqat tizim
/// sozlamalaridan (`openAppSettings()`) yoqish mumkin.
class FacePermissionDenied extends FaceState {
  const FacePermissionDenied({this.permanentlyDenied = false});

  final bool permanentlyDenied;

  @override
  List<Object?> get props => [permanentlyDenied];
}

/// Kamerani ishga tushirishda (`initialize()`) kutilmagan xato yuz berdi.
class FaceCameraError extends FaceState {
  const FaceCameraError();
}

/// `FaceEmbedder.load()` xato bilan tugadi (masalan model asseti
/// yaroqsiz).
class FaceModelError extends FaceState {
  const FaceModelError();
}

/// Kamera oqimi tirik, lekin joriy kadrda yuz topilmadi.
class FaceSearching extends FaceState {
  const FaceSearching();
}

/// Sifat gate'idan o'tolmagan aniq sabab — har biriga sahifada alohida
/// ko'rsatma matni mos keladi.
enum PoorQualityReason {
  /// Yuz kamera bilan solishtirganda juda kichik (uzoqda).
  tooFar,

  /// Yuz kamera bilan solishtirganda juda katta (yaqinda).
  tooClose,

  /// Yuz kadr markazidan ruxsat etilgandan ko'ra ko'proq gorizontal
  /// siljigan VA foydalanuvchi o'zini CHAPGA surishi kerak (Face ID
  /// uslubidagi yo'naltiruvchi ko'rsatma — ilgarigi bitta umumiy
  /// `notCentered` o'rniga, qaysi tomonga surilishi aniq aytiladi).
  /// [FaceCubit._evaluateQuality] hujjatida tushuntirilganidek, old
  /// (selfie) kamera bilan bu — oynalanmagan (raw) kadrda bbox markazi
  /// FRAME MARKAZIDAN CHAPGA (manfiy `dx`) siljiganida chiqadi (mirror
  /// bilan oynalgan preview'da esa foydalanuvchi buni o'z yuzi O'NGDA
  /// ko'rinayotgani sifatida ko'radi — shuning uchun CHAPGA surilishi
  /// kerak).
  moveLeft,

  /// Xuddi shu gorizontal tekshiruv, lekin foydalanuvchi O'NGGA surilishi
  /// kerak — raw kadrda bbox markazi frame markazidan O'NGGA (musbat
  /// `dx`) siljiganida.
  moveRight,

  /// Yuz kadr markazidan ruxsat etilgandan ko'ra ko'proq vertikal
  /// siljigan VA foydalanuvchi YUQORIROQ tutishi kerak — bbox markazi
  /// frame markazidan PASTDA (musbat `dy`, tik oyna qilinmagani uchun
  /// bu o'q raw/ko'rinish orasida farqsiz).
  moveUp,

  /// Xuddi shu vertikal tekshiruv, lekin foydalanuvchi PASTROQ tutishi
  /// kerak — bbox markazi frame markazidan YUQORIDA (manfiy `dy`).
  moveDown,

  /// Bosh burchagi (`headEulerY`) ruxsat etilgan chegaradan katta.
  turned,

  /// Ko'zlarning ochiqlik ehtimoli chegaradan past.
  eyesClosed,

  /// Yorug'lik darajasi past (hozircha signal manbai yo'q — kelajakda
  /// `FaceSignal`ga yorug'lik/luminance qo'shilganda ishlatiladi).
  lowLight,
}

/// Yuz topildi, lekin sifat gate shartlaridan biri hali bajarilmagan.
class FacePoorQuality extends FaceState {
  const FacePoorQuality(this.reason);

  final PoorQualityReason reason;

  @override
  List<Object?> get props => [reason];
}

/// Sifat gate barcha shartlari bajarilgan va barqarorlik hisoblanmoqda.
///
/// [progress] — `stableDuration`ga nisbatan o'tgan vaqt ulushi (`0..1`);
/// `1`ga yetganda avtomatik `capture()` boshlanadi.
class FaceAligning extends FaceState {
  const FaceAligning(this.progress);

  final double progress;

  @override
  List<Object?> get props => [progress];
}

/// Joriy kadr suratga olinmoqda (bbox bo'yicha 112x112 kesilmoqda).
class FaceCapturing extends FaceState {
  const FaceCapturing();
}

/// Kesilgan yuz TFLite model orqali embeddingga aylantirilmoqda.
class FaceEmbedding extends FaceState {
  const FaceEmbedding();
}

/// Hisoblangan shablon xavfsiz xotiraga yozilmoqda (`EnrollFace`).
class FaceEnrolling extends FaceState {
  const FaceEnrolling();
}

/// Yuz muvaffaqiyatli ro'yxatdan o'tkazildi.
class FaceSuccess extends FaceState {
  const FaceSuccess();
}

/// Aniq sabablarga ajratilmagan umumiy xato (masalan tarmoq, saqlash
/// yoki kutilmagan istisno). [message] foydalanuvchiga ko'rsatiladi.
class FaceError extends FaceState {
  const FaceError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

// ===================== Vazifa 17: check-in (liveness) =====================
//
// Quyidagi holatlar `FaceCubit`ning "liveness rejimi"da (`startLiveness()`
// chaqirilgandan keyin) ishlatiladi — yuqoridagi enrollment holatlari bilan
// BITTA sealed ierarxiyada, shunda `face_enroll_page.dart` va
// `face_checkin_page.dart`dagi `switch (state)` ifodalari to'liq
// (exhaustive) bo'lib qoladi.

/// Liveness challenge davom etmoqda: [action] — joriy talab qilinayotgan
/// harakat (`LivenessController.current`). Barcha harakatlar bajarilgan
/// zumda (keyingi kadr [FaceVerifying]ga o'tguncha) `action` `null`
/// bo'lishi mumkin — bu "tugadi" holatini bildiradi.
///
/// [done] / [total] — progress halqasini to'ldirish uchun
/// (`LivenessController.progress * steps.length`dan tiklangan).
class FaceLivenessPrompt extends FaceState {
  const FaceLivenessPrompt({
    required this.action,
    required this.done,
    required this.total,
  });

  final LivenessAction? action;
  final int done;
  final int total;

  @override
  List<Object?> get props => [action, done, total];
}

/// Liveness tugadi: joriy kadr kesilib, embedding hisoblanib,
/// `VerifyFace` orqali saqlangan shablon bilan solishtirilmoqda.
class FaceVerifying extends FaceState {
  const FaceVerifying();
}

/// Yuz mos keldi: joylashuv olinib, `CheckIn` chaqirilmoqda.
class FaceCheckingIn extends FaceState {
  const FaceCheckingIn();
}

/// Davomat muvaffaqiyatli qayd etildi. [time] — qaytgan `AttendanceDay`
/// (yoki soat) dan olingan, foydalanuvchiga ko'rsatiladigan "HH:mm" matni.
class FaceCheckinSuccess extends FaceState {
  const FaceCheckinSuccess(this.time);

  final String time;

  @override
  List<Object?> get props => [time];
}

/// `CheckIn` `Left(GeofenceFailure)` qaytardi — foydalanuvchi ish
/// hududidan tashqarida. [distanceMeters] — hisoblab bo'lsa, ish
/// joyigacha bo'lgan masofa (aks holda `null`, lekin xato baribir aniq
/// holat sifatida ko'rsatiladi).
class FaceGeofenceOutside extends FaceState {
  const FaceGeofenceOutside({this.distanceMeters});

  final double? distanceMeters;

  @override
  List<Object?> get props => [distanceMeters];
}

/// Liveness challenge belgilangan vaqt ichida (~20s) yakunlanmadi.
class FaceLivenessFailed extends FaceState {
  const FaceLivenessFailed();
}

/// `VerifyFace` `passed: false` qaytardi — yuz saqlangan shablon bilan
/// mos kelmadi.
class FaceMatchFailed extends FaceState {
  const FaceMatchFailed();
}
