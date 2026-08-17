import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/face/domain/entities/face_template.dart';

/// Yuz-shabloni xavfsiz saqlash uchun shartnoma.
///
/// `worker_app/features/face/domain/repositories/face_repository.dart`dan
/// FARQLI: fuqaro ilovasida kunlik yuz-tekshiruvi (`verify`) yo'q — faqat
/// bir martalik identity enrollment (ro'yxatdan o'tkazish, keyin PIN bilan
/// qulflanadi) — shuning uchun bu yerda faqat `enroll`/`getTemplate` bor.
abstract class FaceRepository {
  /// Yangi yuz shablonini xavfsiz xotiraga yozadi (mavjud bo'lsa,
  /// almashtiradi).
  Future<Either<Failure, Unit>> enroll(FaceTemplate t);

  /// Saqlangan shablonni o'qiydi; hali ro'yxatdan o'tilmagan bo'lsa
  /// `null` qaytaradi. Bootstrap paytida `faceEnrolled` holatini tiklash
  /// uchun ishlatiladi (qarang: `main.dart`).
  Future<Either<Failure, FaceTemplate?>> getTemplate();
}
