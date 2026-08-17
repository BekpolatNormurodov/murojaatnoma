import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';

/// Ish joyiga o'z-o'zini check-in qilish — avval [GeofenceService] orqali
/// ish hududi ichida ekanini tekshiradi.
///
/// Yuzni tekshirish (face verify) bu usecase'da EMAS: u UI oqimida
/// (Vazifa 17) check-in'dan OLDIN bajariladi va faqat muvaffaqiyatli
/// bo'lganda olingan `screenshotPath` bilan shu usecase chaqiriladi.
/// Shuning uchun bu klass `VerifyFace`/`FaceEmbedder`ga bog'liq emas —
/// faqat `GeofenceService` va `AttendanceRepository`ga.
class CheckIn implements UseCase<AttendanceDay, CheckInParams> {
  CheckIn(this.repository, this.geofenceService);

  final AttendanceRepository repository;
  final GeofenceService geofenceService;

  @override
  Future<Either<Failure, AttendanceDay>> call(CheckInParams params) async {
    if (!geofenceService.isInside(params.lat, params.lng)) {
      return const Left(GeofenceFailure());
    }
    return repository.checkIn(params);
  }
}
