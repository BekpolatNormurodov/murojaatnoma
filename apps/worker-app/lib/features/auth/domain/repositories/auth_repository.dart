import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';

/// Ishchi avtorizatsiyasi uchun shartnoma (telefon/OTP oqimi).
abstract class AuthRepository {
  /// Telefon raqamiga SMS-OTP kod yuborish.
  ///
  /// Muvaffaqiyatli bo'lsa server yuborgan `devCode`ni qaytaradi — bu
  /// backend `OTP_DEV_ECHO=true` bo'lganda (dev/staging, real SMS
  /// gateway'siz login uchun) keladi, aks holda (production) `null`.
  Future<Either<Failure, String?>> sendOtp(String phone);

  /// SMS-OTP kodni tasdiqlash — muvaffaqiyatli bo'lsa sessiya qaytaradi.
  Future<Either<Failure, AuthSession>> verifyOtp({
    required String phone,
    required String code,
  });

  /// Xodim login+parol bilan kirish — muvaffaqiyatli bo'lsa sessiya
  /// qaytaradi va tokenni saqlaydi.
  Future<Either<Failure, AuthSession>> login({
    required String username,
    required String password,
  });

  /// Joriy saqlangan sessiyani o'qish (agar mavjud bo'lsa).
  Future<AuthSession?> currentSession();

  /// Tizimdan chiqish — saqlangan token/sessiyani tozalaydi.
  Future<void> logout();
}
