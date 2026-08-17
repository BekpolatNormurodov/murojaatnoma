// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/requests/data/datasources/applications_remote_data_source.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';

/// `ApplicationsRepository`ning masofaviy-manba (mock/api)
/// implementatsiyasi.
class ApplicationsRepositoryImpl implements ApplicationsRepository {
  ApplicationsRepositoryImpl({required this.remote});

  final ApplicationsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<Application>>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  }) async {
    try {
      final apps = await remote.list(
        assignedOnly: assignedOnly,
        status: status,
        query: query,
      );
      return Right(apps);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Application>> getById(String id) async {
    try {
      final app = await remote.getById(id);
      return Right(app);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Application>> respond(
    String id,
    ApplicationResponse response,
  ) async {
    try {
      final app = await remote.respond(id, response);
      return Right(app);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Application>> rate(String id, int points) async {
    try {
      final app = await remote.rate(id, points);
      return Right(app);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
