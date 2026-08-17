import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';
import 'package:worker_app/features/points/domain/repositories/points_repository.dart';

/// Joriy umumiy ball va reyting o'rnini olish.
class GetCurrentPoints implements UseCase<WorkerPoints, NoParams> {
  GetCurrentPoints(this.repository);

  final PointsRepository repository;

  @override
  Future<Either<Failure, WorkerPoints>> call(NoParams params) {
    return repository.current();
  }
}
