import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';

/// Fuqarolar murojaatlari (arizalar) bilan ishlash uchun shartnoma —
/// ro'yxatni (filtrlash bilan) o'qish, bitta murojaatni olish, javob
/// yozish va ball qo'yish.
abstract class ApplicationsRepository {
  /// Murojaatlar ro'yxatini oladi.
  ///
  /// [assignedOnly] — `true` bo'lsa faqat joriy xodimga biriktirilganlar.
  /// [status] — berilsa, faqat shu holatdagilar bilan filtrlaydi.
  /// [query] — sarlavha/tavsif/kategoriya bo'yicha erkin qidiruv matni.
  Future<Either<Failure, List<Application>>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  });

  /// Bitta murojaatni ID bo'yicha oladi.
  Future<Either<Failure, Application>> getById(String id);

  /// Murojaatga javob yozadi (matn + ixtiyoriy biriktirmalar).
  Future<Either<Failure, Application>> respond(
    String id,
    ApplicationResponse response,
  );

  /// Murojaatga ball qo'yadi (baholash/yopish bosqichi).
  Future<Either<Failure, Application>> rate(String id, int points);
}
