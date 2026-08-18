import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/calls/data/datasources/call_remote_data_source.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';
import 'package:worker_app/features/calls/domain/repositories/call_repository.dart';

/// `CallRepository`ning masofaviy-manba (mock/api) implementatsiyasi —
/// `Exception`larni `Failure`ga aylantiradi (attendance bilan bir xil naqsh).
class CallRepositoryImpl implements CallRepository {
  CallRepositoryImpl({required this.remote});

  final CallRemoteDataSource remote;

  @override
  Future<Either<Failure, List<Map<String, dynamic>>>> iceServers() async {
    try {
      return Right(await remote.iceServers());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('ICE serverlarni olishda xatolik'));
    }
  }

  @override
  Future<Either<Failure, List<CallLogEntry>>> history({int limit = 50}) async {
    try {
      return Right(await remote.history(limit: limit));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure("Qo'ng'iroqlar tarixida xatolik"));
    }
  }
}
