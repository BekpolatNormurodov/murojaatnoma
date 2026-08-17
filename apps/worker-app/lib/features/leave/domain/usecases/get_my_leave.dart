import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/leave/domain/entities/leave_request.dart';
import 'package:worker_app/features/leave/domain/repositories/leave_repository.dart';

/// Joriy xodimning ta'til so'rovlari ro'yxatini (eng yangisi birinchi)
/// olish.
class GetMyLeave implements UseCase<List<LeaveRequest>, NoParams> {
  GetMyLeave(this.repository);

  final LeaveRepository repository;

  @override
  Future<Either<Failure, List<LeaveRequest>>> call(NoParams params) {
    return repository.myRequests();
  }
}
