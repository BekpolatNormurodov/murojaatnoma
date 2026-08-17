import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';

/// `CitizenRequestsRepository`ning masofaviy-manba (mock/api)
/// implementatsiyasi.
class CitizenRequestsRepositoryImpl implements CitizenRequestsRepository {
  CitizenRequestsRepositoryImpl({required this.remote});

  final CitizenRequestsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<CitizenRequest>>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  }) async {
    try {
      final items = await remote.list(kind: kind, status: status, query: query);
      return Right(items);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, CitizenRequest>> getById(String id) async {
    try {
      return Right(await remote.getById(id));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, CitizenRequest>> submit(CitizenRequest draft) async {
    try {
      return Right(await remote.submit(draft));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
