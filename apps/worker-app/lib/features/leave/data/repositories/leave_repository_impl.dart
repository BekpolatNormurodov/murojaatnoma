// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/leave/data/datasources/leave_remote_data_source.dart';
import 'package:worker_app/features/leave/domain/entities/leave_request.dart';
import 'package:worker_app/features/leave/domain/leave_request_validation.dart';
import 'package:worker_app/features/leave/domain/repositories/leave_repository.dart';

/// `LeaveRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class LeaveRepositoryImpl implements LeaveRepository {
  LeaveRepositoryImpl({required this.remote});

  final LeaveRemoteDataSource remote;

  @override
  Future<Either<Failure, LeaveRequest>> submit({
    required LeaveDurationType type,
    required int amount,
    required String startDate,
    required String reason,
    String? startTime,
  }) async {
    try {
      final result = await remote.submit(
        type: type,
        amount: amount,
        startDate: startDate,
        startTime: startTime,
        reason: reason,
      );
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, List<LeaveRequest>>> myRequests() async {
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
