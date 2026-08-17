import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/leave/domain/entities/leave_request.dart';
import 'package:worker_app/features/leave/domain/leave_request_validation.dart';
import 'package:worker_app/features/leave/domain/repositories/leave_repository.dart';

/// Yangi ta'til ("javob so'rash") so'rovi yuborish.
class SubmitLeave implements UseCase<LeaveRequest, SubmitLeaveParams> {
  SubmitLeave(this.repository);

  final LeaveRepository repository;

  @override
  Future<Either<Failure, LeaveRequest>> call(SubmitLeaveParams params) {
    return repository.submit(
      type: params.type,
      amount: params.amount,
      startDate: params.startDate,
      startTime: params.startTime,
      reason: params.reason,
    );
  }
}

/// [SubmitLeave] uchun kirish parametrlari.
class SubmitLeaveParams extends Equatable {
  const SubmitLeaveParams({
    required this.type,
    required this.amount,
    required this.startDate,
    required this.reason,
    this.startTime,
  });

  final LeaveDurationType type;
  final int amount;

  /// ISO sana, masalan `'2026-08-20'`.
  final String startDate;

  /// `'HH:mm'` — faqat [LeaveDurationType.hours] uchun.
  final String? startTime;
  final String reason;

  @override
  List<Object?> get props => [type, amount, startDate, startTime, reason];
}
