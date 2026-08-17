part of 'auth_cubit.dart';

enum AuthStatus { initial, loading, otpSent, authenticated, error }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.initial,
    this.session,
    this.registered = false,
    this.faceEnrolled = false,
    this.pinSet = false,
    this.pinUnlocked = false,
    this.errorMessage,
  });

  final AuthStatus status;
  final AuthSession? session;

  /// Fuqaro shaxsiy ma'lumotlarini (`/register`: F.I.Sh., JSHSHIR/pasport,
  /// tug'ilgan sana, viloyat/tuman, manzil) to'ldirganmi — PERSISTENT
  /// (qurilmadagi `RegistrationRepository`dan bootstrap paytida tiklanadi,
  /// qarang: `main.dart`). Faza 3 oqimida: OTP → REGISTER → FACE → PIN →
  /// home — ya'ni `faceEnrolled`dan OLDIN tekshiriladi (qarang:
  /// `redirect_policy.dart`).
  final bool registered;

  /// Fuqaro yuzi ro'yxatdan o'tkazilganmi — PERSISTENT (qurilmadagi
  /// `FaceRepository`dan bootstrap paytida tiklanadi, qarang:
  /// `main.dart`). Faza 3 oqimida: OTP → REGISTER → FACE → PIN → home.
  final bool faceEnrolled;

  /// Fuqaro PIN kod o'rnatganmi — PERSISTENT (qurilmadagi
  /// `PinRepository`dan bootstrap paytida tiklanadi).
  final bool pinSet;

  /// PIN joriy ilova-sessiyasida OCHILGANMI — SESSIYA-ICHI (in-memory,
  /// HECH QACHON saqlanmaydi): har bir sovuq ishga tushirishda `false`dan
  /// boshlanadi — bu aynan "qulf" o'zi. Faqat to'g'ri PIN kiritilgach
  /// (`/pin/unlock`) yoki PIN yangi o'rnatilgach (`/pin/set` — foydalanuvchi
  /// uni hozirgina isbotladi, qayta so'ralmaydi) `true`ga o'tadi.
  final bool pinUnlocked;

  final String? errorMessage;

  /// Fuqaro tizimga muvaffaqiyatli kirgan bo'lsa `true`.
  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    bool? registered,
    bool? faceEnrolled,
    bool? pinSet,
    bool? pinUnlocked,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      registered: registered ?? this.registered,
      faceEnrolled: faceEnrolled ?? this.faceEnrolled,
      pinSet: pinSet ?? this.pinSet,
      pinUnlocked: pinUnlocked ?? this.pinUnlocked,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [
    status,
    session,
    registered,
    faceEnrolled,
    pinSet,
    pinUnlocked,
    errorMessage,
  ];
}
