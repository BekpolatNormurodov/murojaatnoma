import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/attendance/data/exceptions/attendance_exceptions.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/errors/attendance_failures.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';

/// `AttendanceRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
///
/// Xatolik xaritalash: datasource ANIQ HTTP holatiga mos maxsus
/// istisnolarni (`AlreadyCheckedInException`/`AlreadyCheckedOutException`/
/// `NotCheckedInException`) uloqtiradi — bu yerda tegishli, backend `uz`
/// xabarini saqlagan `Failure` turlariga aylantiriladi. Boshqa hamma narsa
/// (umumiy `ServerException` yoki kutilmagan `Exception`) — `ServerFailure`.
class AttendanceRepositoryImpl implements AttendanceRepository {
  AttendanceRepositoryImpl({required this.remote});

  final AttendanceRemoteDataSource remote;

  @override
  Future<Either<Failure, CheckScanResult>> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final result = await remote.checkIn(
        embedding: embedding,
        latitude: latitude,
        longitude: longitude,
      );
      return Right(result);
    } on AlreadyCheckedInException catch (e) {
      return Left(AlreadyCheckedInFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, CheckScanResult>> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final result = await remote.checkOut(
        embedding: embedding,
        latitude: latitude,
        longitude: longitude,
      );
      return Right(result);
    } on AlreadyCheckedOutException catch (e) {
      return Left(AlreadyCheckedOutFailure(e.message));
    } on NotCheckedInException catch (e) {
      return Left(NotCheckedInFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, MyAttendance>> myAttendance() async {
    try {
      final result = await remote.myAttendance();
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
