import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';

/// Davomat (attendance) — SERVER-SIDE yuz tanish orqali check-in/check-out
/// va joriy holatni o'qish uchun shartnoma.
///
/// **Jonli backend kontrakti** (yuz moslikni endi mahalliy emas, SERVER
/// hisoblaydi — `embedding` shunchaki yuboriladi, `employeeId` YO'Q, u
/// JWT'dan olinadi):
/// - `POST /attendance/check-in { embedding, latitude, longitude } ->
///   AttendanceRecord` — 409 agar bugun allaqachon check-in qilingan
///   bo'lsa.
/// - `POST /attendance/check-out { embedding, latitude, longitude } ->
///   AttendanceRecord` — 400 agar bugun hali check-in qilinmagan bo'lsa,
///   409 agar allaqachon check-out qilingan bo'lsa.
/// - `GET /attendance/me -> { ..., today, week }` — bugungi holat +
///   so'nggi hafta, BITTA so'rovda.
///
/// Eski `history()` (`GET /attendance/history`) OLIB TASHLANDI — jonli
/// backend kontraktida bunday endpoint YO'Q; [myAttendance] uning o'rnini
/// bosadi (`AttendanceCubit.load()` endi shuni chaqiradi, qarang:
/// `presentation/bloc/attendance_cubit.dart`).
///
/// Geofence tekshiruvi bu qatlamda EMAS — uni chaqiruvchi (`CheckIn`/
/// `CheckOut` usecase) allaqachon (mahalliy, tezkor) bajargan bo'ladi;
/// server o'z tomonidan yana bir bor (yakuniy) tekshiradi.
abstract class AttendanceRepository {
  /// Joriy koordinata va yuz probe embeddingi bilan bugungi kunga
  /// check-in qiladi — moslikni SERVER hisoblaydi (natija:
  /// [CheckScanResult.isValid]/[CheckScanResult.faceScore]).
  Future<Either<Failure, CheckScanResult>> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  });

  /// Xuddi [checkIn] kabi, lekin bugungi ish kunini yakunlash
  /// (check-out) uchun.
  Future<Either<Failure, CheckScanResult>> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  });

  /// Joriy xodimning bugungi holati + so'nggi hafta tarixini bitta
  /// so'rovda o'qiydi.
  Future<Either<Failure, MyAttendance>> myAttendance();
}
