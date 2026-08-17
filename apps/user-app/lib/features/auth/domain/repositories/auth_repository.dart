import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';

/// Fuqaro avtorizatsiyasi uchun shartnoma (telefon/OTP oqimi).
abstract class AuthRepository {
  /// Telefon raqamiga SMS-OTP kod yuborish.
  Future<Either<Failure, Unit>> sendOtp(String phone);

  /// SMS-OTP kodni tasdiqlash — muvaffaqiyatli bo'lsa sessiya qaytaradi.
  Future<Either<Failure, AuthSession>> verifyOtp({
    required String phone,
    required String code,
  });

  /// Joriy saqlangan sessiyani o'qish (agar mavjud bo'lsa).
  Future<AuthSession?> currentSession();

  /// Tizimdan chiqish — saqlangan token/sessiyani tozalaydi.
  Future<void> logout();
}
