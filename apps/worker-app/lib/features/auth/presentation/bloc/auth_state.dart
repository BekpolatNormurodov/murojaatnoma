part of 'auth_cubit.dart';

enum AuthStatus { initial, loading, otpSent, authenticated, error }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.initial,
    this.session,
    this.faceEnrolled = false,
    this.errorMessage,
  });

  final AuthStatus status;
  final AuthSession? session;

  /// Ishchi yuzi ro'yxatdan o'tkazilganmi — Task 18 (yuz bilan davomat)
  /// oqimida ishlatiladi.
  final bool faceEnrolled;
  final String? errorMessage;

  /// Ishchi tizimga muvaffaqiyatli kirgan bo'lsa `true`.
  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    bool? faceEnrolled,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      faceEnrolled: faceEnrolled ?? this.faceEnrolled,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, session, faceEnrolled, errorMessage];
}
