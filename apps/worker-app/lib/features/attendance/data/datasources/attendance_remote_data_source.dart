import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:worker_app/core/mock/mock_attendance.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';

/// Davomat (check-in / tarix) uchun masofaviy ma'lumot manbai.
abstract class AttendanceRemoteDataSource {
  Future<AttendanceDay> checkIn(CheckInParams params);

  Future<List<AttendanceDay>> history();
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_attendance.dart`dagi xotiradagi
/// ro'yxat bilan ishlaydi.
class AttendanceRemoteDataSourceMockImpl
    implements AttendanceRemoteDataSource {
  @override
  Future<AttendanceDay> checkIn(CheckInParams params) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));

    final now = DateTime.now();
    final time = DateFormat('HH:mm').format(now);
    final day = AttendanceDay(
      date: DateFormat('yyyy-MM-dd').format(now),
      checkIn: time,
      checkOut: null,
      status: AttendanceStatus.present,
      hours: 0,
      insideGeofence: true,
      selfConfirmed: true,
      confirmedAt: time,
    );
    mockAttendanceHistory.add(day);
    return day;
  }

  @override
  Future<List<AttendanceDay>> history() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return List.unmodifiable(mockAttendanceHistory);
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class AttendanceRemoteDataSourceApiImpl implements AttendanceRemoteDataSource {
  AttendanceRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  /// Backend kontrakti: `POST /attendance/check-in { employeeId,
  /// embedding, latitude, longitude } -> AttendanceRecord`. Moslikni
  /// (>=0.7 kosinus o'xshashlik) SERVER o'zi hisoblaydi — shuning uchun
  /// `params.embedding`/`params.employeeId` (`FaceCubit._afterMatch`da
  /// `useMock == false` bo'lganda to'ldiriladi) to'g'ridan-to'g'ri
  /// yuboriladi. `screenshotPath` faqat mahalliy (davomat isboti) —
  /// backend kontraktida yo'q, shuning uchun jonli so'rovga qo'shilmaydi.
  @override
  Future<AttendanceDay> checkIn(CheckInParams params) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/attendance/check-in',
        data: {
          'employeeId': params.employeeId,
          'embedding': params.embedding,
          'latitude': params.lat,
          'longitude': params.lng,
        },
      );
      return AttendanceDay.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<List<AttendanceDay>> history() async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/attendance/history',
      );
      final data = response.data ?? const [];
      return data
          .map((e) => AttendanceDay.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
