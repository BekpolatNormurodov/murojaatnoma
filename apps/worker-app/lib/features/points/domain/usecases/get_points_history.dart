import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';
import 'package:worker_app/features/points/domain/repositories/points_repository.dart';

/// Ball o'zgarishlar tarixini olish.
class GetPointsHistory implements UseCase<List<PointsEntry>, NoParams> {
  GetPointsHistory(this.repository);

  final PointsRepository repository;

  @override
  Future<Either<Failure, List<PointsEntry>>> call(NoParams params) {
    return repository.history();
  }
}
