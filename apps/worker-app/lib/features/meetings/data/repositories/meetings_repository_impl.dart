// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/meetings/data/datasources/meetings_remote_data_source.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/domain/repositories/meetings_repository.dart';

/// `MeetingsRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class MeetingsRepositoryImpl implements MeetingsRepository {
  MeetingsRepositoryImpl({required this.remote});

  final MeetingsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<Meeting>>> list({MeetingStatus? status}) async {
    try {
      final result = await remote.list(status: status);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Meeting>> getById(String id) async {
    try {
      final result = await remote.getById(id);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Meeting>> join(String id) async {
    try {
      final result = await remote.join(id);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
