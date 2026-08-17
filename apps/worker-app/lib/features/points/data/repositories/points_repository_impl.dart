// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/points/data/datasources/points_remote_data_source.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';
import 'package:worker_app/features/points/domain/repositories/points_repository.dart';

/// `PointsRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class PointsRepositoryImpl implements PointsRepository {
  PointsRepositoryImpl({required this.remote});

  final PointsRemoteDataSource remote;

  @override
  Future<Either<Failure, WorkerPoints>> current() async {
    try {
      final result = await remote.current();
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, List<PointsEntry>>> history() async {
    try {
      final result = await remote.history();
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
