import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/salary/domain/entities/salary.dart';
import 'package:worker_app/features/salary/domain/repositories/salary_repository.dart';

/// Xodimning o'z oylik maosh tarixini olish (`GET /salaries/me`).
class GetMySalaries implements UseCase<List<Salary>, NoParams> {
  GetMySalaries(this.repository);

  final SalaryRepository repository;

  @override
  Future<Either<Failure, List<Salary>>> call(NoParams params) {
    return repository.mine();
  }
}
