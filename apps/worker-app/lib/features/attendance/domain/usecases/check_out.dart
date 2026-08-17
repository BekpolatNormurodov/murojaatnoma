import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/attendance_scan_params.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';

/// Bugungi ish kunini yakunlash (check-out) — [CheckIn]ning
/// "oynadagi aksi": avval [GeofenceService] orqali ish hududi ichida
/// ekanini (mahalliy, tezkor) tekshiradi, so'ng
/// [AttendanceRepository.checkOut]ni chaqiradi — moslikni YAKUNIY
/// SERVER hisoblaydi (`CheckScanResult`).
///
/// Server tomoni qo'shimcha holatlarni tekshiradi: bugun hali check-in
/// qilinmagan bo'lsa `NotCheckedInFailure` (400), allaqachon check-out
/// qilingan bo'lsa `AlreadyCheckedOutFailure` (409) — qarang:
/// `AttendanceRepositoryImpl.checkOut`.
class CheckOut implements UseCase<CheckScanResult, AttendanceScanParams> {
  CheckOut(this.repository, this.geofenceService);

  final AttendanceRepository repository;
  final GeofenceService geofenceService;

  @override
  Future<Either<Failure, CheckScanResult>> call(
    AttendanceScanParams params,
  ) async {
    if (!geofenceService.isInside(params.latitude, params.longitude)) {
      return const Left(GeofenceFailure());
    }
    return repository.checkOut(
      embedding: params.embedding,
      latitude: params.latitude,
      longitude: params.longitude,
    );
  }
}
