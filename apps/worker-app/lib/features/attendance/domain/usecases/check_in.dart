import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/attendance_scan_params.dart';

/// Ish joyiga o'z-o'zini check-in qilish — avval [GeofenceService] orqali
/// ish hududi ichida ekanini (mahalliy, tezkor) tekshiradi, so'ng
/// [AttendanceRepository.checkIn]ni chaqiradi — moslikni YAKUNIY
/// SERVER hisoblaydi (`CheckScanResult`).
///
/// Yuzni tekshirish (face verify/liveness) bu usecase'da EMAS: u UI
/// oqimida (`FaceCubit`) check-in'dan OLDIN bajariladi va faqat
/// muvaffaqiyatli bo'lganda olingan probe `embedding` bilan shu usecase
/// chaqiriladi. Shuning uchun bu klass `VerifyFace`/`FaceEmbedder`ga
/// bog'liq emas — faqat `GeofenceService` va `AttendanceRepository`ga.
class CheckIn implements UseCase<CheckScanResult, AttendanceScanParams> {
  CheckIn(this.repository, this.geofenceService, {this.localGate = true});

  final AttendanceRepository repository;
  final GeofenceService geofenceService;

  /// Mahalliy (qattiq-kodlangan) radius tekshiruvi — faqat demo rejimda.
  /// Jonli backendda qarorni SERVER qiladi (xodimning ofisi + mahallalari);
  /// eski qattiq-kodlangan nuqta haqiqiy ofisdan ~8 km uzoqda edi.
  final bool localGate;

  @override
  Future<Either<Failure, CheckScanResult>> call(
    AttendanceScanParams params,
  ) async {
    if (localGate &&
        !geofenceService.isInside(params.latitude, params.longitude)) {
      return const Left(GeofenceFailure());
    }
    return repository.checkIn(
      embedding: params.embedding,
      latitude: params.latitude,
      longitude: params.longitude,
      photoUrl: params.photoUrl,
    );
  }
}
