import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';

/// Ball nazorati moduli bilan ishlash uchun shartnoma — joriy ball
/// holatini va o'zgarishlar tarixini o'qish.
abstract class PointsRepository {
  /// Joriy umumiy ball va reyting o'rnini (tarix bilan birga) oladi.
  Future<Either<Failure, WorkerPoints>> current();

  /// Ball o'zgarishlar tarixini (alohida) oladi.
  Future<Either<Failure, List<PointsEntry>>> history();
}
