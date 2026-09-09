// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/salary/data/datasources/salary_remote_data_source.dart';
import 'package:worker_app/features/salary/domain/entities/salary.dart';
import 'package:worker_app/features/salary/domain/repositories/salary_repository.dart';

/// `SalaryRepository`ning masofaviy-manba (mock/api) implementatsiyasi
/// (`PointsRepositoryImpl` bilan bir xil naqsh).
class SalaryRepositoryImpl implements SalaryRepository {
  SalaryRepositoryImpl({required this.remote});

  final SalaryRemoteDataSource remote;

  @override
  Future<Either<Failure, List<Salary>>> mine() async {
    try {
      final result = await remote.mine();
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
