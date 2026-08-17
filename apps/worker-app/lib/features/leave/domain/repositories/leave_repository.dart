import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/leave/domain/entities/leave_request.dart';
import 'package:worker_app/features/leave/domain/leave_request_validation.dart';

/// Ta'til ("javob so'rash") moduli bilan ishlash uchun shartnoma — yangi
/// so'rov yuborish va joriy xodimning o'z so'rovlari ro'yxatini o'qish.
abstract class LeaveRepository {
  /// Yangi ta'til so'rovi yuboradi. `id`/`status`/`createdAt` server
  /// tomonidan belgilanadi (yangi so'rov `status` — `pending`).
  Future<Either<Failure, LeaveRequest>> submit({
    required LeaveDurationType type,
    required int amount,
    required String startDate,
    required String reason,
    String? startTime,
  });

  /// Joriy xodimning barcha ta'til so'rovlarini (eng yangisi birinchi)
  /// oladi.
  Future<Either<Failure, List<LeaveRequest>>> myRequests();
}
