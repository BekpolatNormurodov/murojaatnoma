import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';

/// Majlislar (yig'ilishlar) moduli bilan ishlash uchun shartnoma —
/// ro'yxatni (holat bo'yicha filtrlash bilan) o'qish, bitta majlisni
/// olish va unga qo'shilish.
abstract class MeetingsRepository {
  /// Majlislar ro'yxatini oladi.
  ///
  /// [status] — berilsa, faqat shu holatdagi majlislar bilan filtrlaydi.
  Future<Either<Failure, List<Meeting>>> list({MeetingStatus? status});

  /// Bitta majlisni ID bo'yicha oladi.
  Future<Either<Failure, Meeting>> getById(String id);

  /// Majlisga qo'shiladi — qo'shilish havolasi (join URL) bilan
  /// yangilangan majlisni qaytaradi.
  Future<Either<Failure, Meeting>> join(String id);
}
