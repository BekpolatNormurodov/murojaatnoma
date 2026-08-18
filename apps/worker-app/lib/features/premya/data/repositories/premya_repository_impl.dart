// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/premya/data/datasources/premya_remote_data_source.dart';
import 'package:worker_app/features/premya/domain/entities/bonus_request.dart';
import 'package:worker_app/features/premya/domain/repositories/premya_repository.dart';

/// `PremyaRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class PremyaRepositoryImpl implements PremyaRepository {
  PremyaRepositoryImpl({required this.remote});

  final PremyaRemoteDataSource remote;

  @override
  Future<Either<Failure, BonusRequest>> submit({
    required String reason,
    int? amount,
  }) async {
    try {
      final result = await remote.submit(reason: reason, amount: amount);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, List<BonusRequest>>> myRequests() async {
    try {
      final result = await remote.myRequests();
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
