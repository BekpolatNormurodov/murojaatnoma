import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';

/// Fuqaro shaxsiy ma'lumotlarini (`CitizenProfile`) xavfsiz saqlash uchun
/// shartnoma.
///
/// `FaceRepository`/`PinRepository` bilan bir xil naqsh: bitta yozish
/// (`saveProfile`) + bitta o'qish (`getProfile`, hali to'ldirilmagan bo'lsa
/// `null`) — backend yo'q, faqat qurilma-ichi (mock/local-only).
abstract class RegistrationRepository {
  /// Fuqaro profilini xavfsiz xotiraga yozadi (mavjud bo'lsa, almashtiradi).
  Future<Either<Failure, Unit>> saveProfile(CitizenProfile profile);

  /// Saqlangan profilni o'qiydi; hali ro'yxatdan o'tilmagan bo'lsa `null`
  /// qaytaradi. Bootstrap paytida `AuthState.registered`ni tiklash uchun
  /// ishlatiladi (qarang: `main.dart`).
  Future<Either<Failure, CitizenProfile?>> getProfile();
}
