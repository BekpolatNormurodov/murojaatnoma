import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/premya/domain/entities/bonus_request.dart';

/// Premya ("mukofot so'rash") moduli bilan ishlash uchun shartnoma — yangi
/// so'rov yuborish va joriy xodimning o'z so'rovlari ro'yxatini o'qish.
abstract class PremyaRepository {
  /// Yangi premya so'rovi yuboradi. `id`/`status`/`createdAt` server
  /// tomonidan belgilanadi (yangi so'rov `status` — `pending`).
  Future<Either<Failure, BonusRequest>> submit({
    required String reason,
    int? amount,
  });

  /// Joriy xodimning barcha premya so'rovlarini (eng yangisi birinchi)
  /// oladi.
  Future<Either<Failure, List<BonusRequest>>> myRequests();
}
