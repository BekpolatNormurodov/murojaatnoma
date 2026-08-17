import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';

/// Fuqaroning arizalari/shikoyatlari bilan ishlash uchun shartnoma —
/// ro'yxatni (filtrlash bilan) o'qish, bitta murojaatni olish va yangi
/// murojaat yuborish.
abstract class CitizenRequestsRepository {
  /// Fuqaroning murojaatlari ro'yxatini oladi.
  ///
  /// [kind] — berilsa, faqat shu turdagilar (ariza/shikoyat) bilan
  /// filtrlaydi; `null` bo'lsa ikkalasi ham qaytadi.
  /// [status] — berilsa, faqat shu holatdagilar bilan filtrlaydi.
  /// [query] — sarlavha/matn/kategoriya bo'yicha erkin qidiruv matni.
  Future<Either<Failure, List<CitizenRequest>>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  });

  /// Bitta murojaatni ID bo'yicha oladi.
  Future<Either<Failure, CitizenRequest>> getById(String id);

  /// Yangi ariza/shikoyat yuboradi. [draft]ning `id`/`status`/`createdAt`
  /// maydonlari server (yoki mock) tomonidan almashtiriladi — chaqiruvchi
  /// faqat `kind`/`category`/`title`/`body`/`attachments`ni to'ldiradi.
  Future<Either<Failure, CitizenRequest>> submit(CitizenRequest draft);
}
