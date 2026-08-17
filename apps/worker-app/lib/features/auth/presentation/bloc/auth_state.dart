part of 'auth_cubit.dart';

enum AuthStatus { initial, loading, otpSent, authenticated, error }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.initial,
    this.session,
    this.faceEnrolled = false,
    this.errorMessage,
    this.devCode,
  });

  final AuthStatus status;
  final AuthSession? session;

  /// Ishchi yuzi ro'yxatdan o'tkazilganmi — Task 18 (yuz bilan davomat)
  /// oqimida ishlatiladi.
  final bool faceEnrolled;
  final String? errorMessage;

  /// `requestOtp()` chaqiruvi natijasida server qaytargan SMS-OTP kod —
  /// FAQAT backend `OTP_DEV_ECHO=true` bo'lganda (dev/staging) keladi, shu
  /// orqali real SMS gateway'siz login qilish mumkin. Production'da (yoki
  /// mock oqimda) doim `null` — OTP sahifasi shu holatda hech qanday
  /// maslahat/hint ko'rsatmaydi, shuning uchun kod hech qachon "sizib
  /// chiqmaydi" (leak bo'lmaydi).
  ///
  /// `session`/`faceEnrolled` kabi (`errorMessage`dan farqli) yangi
  /// `requestOtp()` chaqirilguncha SAQLANIB qoladi — aks holda noto'g'ri
  /// kod kiritilgan urinishdan keyin (`verifyOtp` xatosi) maslahat
  /// ekrandan g'oyib bo'lib, foydalanuvchi haqiqiy amal qilayotgan kodni
  /// yo'qotib qo'yardi. To'liq tozalash faqat `reset()` (yangi
  /// `AuthState()`) yoki yangi `requestOtp()` natijasi orqali bo'ladi.
  final String? devCode;

  /// Ishchi tizimga muvaffaqiyatli kirgan bo'lsa `true`.
  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    bool? faceEnrolled,
    String? errorMessage,
    String? devCode,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      faceEnrolled: faceEnrolled ?? this.faceEnrolled,
      errorMessage: errorMessage,
      devCode: devCode ?? this.devCode,
    );
  }

  @override
  List<Object?> get props => [
    status,
    session,
    faceEnrolled,
    errorMessage,
    devCode,
  ];
}
