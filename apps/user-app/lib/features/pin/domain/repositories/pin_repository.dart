import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';

/// Ilova-qulf PIN kodini xavfsiz saqlash/tekshirish uchun shartnoma.
///
/// PIN hech qachon ochiq (plaintext) matn sifatida saqlanmaydi — faqat
/// xeshi (qarang: `PinHasher`). `FaceRepository` bilan bir xil qatlam
/// naqshi (`domain` → `data` → `flutter_secure_storage`).
abstract class PinRepository {
  /// Yangi PIN kodni xeshlab, xavfsiz xotiraga yozadi (mavjud bo'lsa,
  /// almashtiradi).
  Future<Either<Failure, Unit>> setPin(String pin);

  /// [pin]ning xeshini saqlangan xesh bilan solishtiradi. Hali PIN
  /// o'rnatilmagan bo'lsa `Right(false)` qaytaradi (xato emas).
  Future<Either<Failure, bool>> verifyPin(String pin);

  /// Foydalanuvchi uchun PIN allaqachon o'rnatilganmi. Bootstrap paytida
  /// `AuthState.pinSet`ni tiklash uchun ishlatiladi (qarang: `main.dart`).
  Future<Either<Failure, bool>> hasPin();
}
