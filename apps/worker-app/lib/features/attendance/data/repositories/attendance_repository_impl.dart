import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';

/// `AttendanceRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class AttendanceRepositoryImpl implements AttendanceRepository {
  AttendanceRepositoryImpl({required this.remote});

  final AttendanceRemoteDataSource remote;

  @override
  Future<Either<Failure, AttendanceDay>> checkIn(CheckInParams params) async {
    try {
      final day = await remote.checkIn(params);
      return Right(day);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, List<AttendanceDay>>> history() async {
    try {
      final days = await remote.history();
      return Right(days);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
