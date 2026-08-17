import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:worker_app/features/attendance/data/exceptions/attendance_exceptions.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';

/// Davomat (check-in / check-out / joriy holat) uchun masofaviy ma'lumot
/// manbai — jonli backend kontrakti:
/// - `POST /attendance/check-in { embedding, latitude, longitude } ->
///   AttendanceRecord` (409 — bugun allaqachon check-in qilingan).
/// - `POST /attendance/check-out { embedding, latitude, longitude } ->
///   AttendanceRecord` (400 — hali check-in qilinmagan; 409 — allaqachon
///   check-out qilingan).
/// - `GET /attendance/me -> { ..., today, week }`.
abstract class AttendanceRemoteDataSource {
  Future<CheckScanResult> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  });

  Future<CheckScanResult> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  });

  Future<MyAttendance> myAttendance();
}

/// Mock implementatsiya (backend tayyor bo'lguncha/`AppConfig.useMock ==
/// true`da) — xotirada oddiy holat saqlaydi (bugun check-in/check-out
/// qilinganmi), shunda `myAttendance()` izchil ("bugun kelgan/ketgan")
/// javob qaytaradi. `lib/core/mock/mock_attendance.dart`ga ATAYLAB
/// bog'liq EMAS — u eski (`history()`) kontraktga mos edi va endi
/// ishlatilmaydi; bu klass o'zining kichik, o'zi yetarli mock holatini
/// saqlaydi.
class AttendanceRemoteDataSourceMockImpl
    implements AttendanceRemoteDataSource {
  DateTime? _todayCheckInAt;
  DateTime? _todayCheckOutAt;

  static final _hhmmFormat = DateFormat('HH:mm');
  static final _dateFormat = DateFormat('yyyy-MM-dd');

  @override
  Future<CheckScanResult> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final now = DateTime.now();
    _todayCheckInAt = now;
    _todayCheckOutAt = null;

    final workStart = DateTime(now.year, now.month, now.day, 9);
    final lateMinutes = now.isAfter(workStart)
        ? now.difference(workStart).inMinutes
        : 0;

    return CheckScanResult(
      isValid: true,
      faceScore: 0.94,
      type: 'CHECK_IN',
      isLate: lateMinutes > 0,
      lateMinutes: lateMinutes,
      recordedAt: now,
    );
  }

  @override
  Future<CheckScanResult> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final now = DateTime.now();
    _todayCheckOutAt = now;

    return CheckScanResult(
      isValid: true,
      faceScore: 0.93,
      type: 'CHECK_OUT',
      isLate: false,
      lateMinutes: 0,
      recordedAt: now,
    );
  }

  @override
  Future<MyAttendance> myAttendance() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final now = DateTime.now();
    final checkInAt = _todayCheckInAt;
    final checkOutAt = _todayCheckOutAt;

    final today = AttendanceDay(
      date: _dateFormat.format(now),
      checkIn: checkInAt == null ? null : _hhmmFormat.format(checkInAt),
      checkOut: checkOutAt == null ? null : _hhmmFormat.format(checkOutAt),
      status: checkInAt == null
          ? AttendanceStatus.absent
          : AttendanceStatus.present,
      hours: (checkInAt != null && checkOutAt != null)
          ? checkOutAt.difference(checkInAt).inMinutes / 60
          : 0,
      insideGeofence: true,
      selfConfirmed: checkInAt != null,
      confirmedAt: checkInAt == null ? null : _hhmmFormat.format(checkInAt),
    );

    // Oldingi 6 kunlik ishonarli (believable) MOCK tarix — har doim bir
    // xil, sana faqat "bugun"ga nisbatan siljitiladi (shu bois test/demo
    // ishga tushirilgan kunidan qat'i nazar bir xil ko'rinadi).
    const pastPattern = [
      (daysAgo: 6, status: AttendanceStatus.present, hours: 9.0),
      (daysAgo: 5, status: AttendanceStatus.late, hours: 8.6),
      (daysAgo: 4, status: AttendanceStatus.present, hours: 9.1),
      (daysAgo: 3, status: AttendanceStatus.present, hours: 8.9),
      (daysAgo: 2, status: AttendanceStatus.absent, hours: 0.0),
      (daysAgo: 1, status: AttendanceStatus.present, hours: 9.0),
    ];
    final week = [
      for (final entry in pastPattern)
        _pastDay(now, entry.daysAgo, entry.status, entry.hours),
      today,
    ];

    return MyAttendance(
      employeeId: 'MOCK-0001',
      fullName: 'Mock Foydalanuvchi',
      department: 'Kommunal xizmat',
      workStartTime: '09:00',
      today: today,
      week: week,
    );
  }

  AttendanceDay _pastDay(
    DateTime now,
    int daysAgo,
    AttendanceStatus status,
    double hours,
  ) {
    final date = now.subtract(Duration(days: daysAgo));
    final absent = status == AttendanceStatus.absent;
    final checkInTime = absent
        ? null
        : _hhmmFormat.format(DateTime(date.year, date.month, date.day, 9, 5));
    final checkOutTime = absent
        ? null
        : _hhmmFormat.format(DateTime(date.year, date.month, date.day, 18));
    return AttendanceDay(
      date: _dateFormat.format(date),
      checkIn: checkInTime,
      checkOut: checkOutTime,
      status: status,
      hours: hours,
      insideGeofence: true,
      selfConfirmed: !absent,
      confirmedAt: checkInTime,
    );
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// Moslikni (odatda >=0.7 kosinus o'xshashlik) SERVER o'zi hisoblaydi —
/// shuning uchun `embedding` to'g'ridan-to'g'ri yuboriladi. `employeeId`
/// YUBORILMAYDI (server JWT'dan oladi, qarang: `AuthInterceptor`, u
/// `app_core`da allaqachon `Authorization` sarlavhasini biriktiradi).
class AttendanceRemoteDataSourceApiImpl implements AttendanceRemoteDataSource {
  AttendanceRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<CheckScanResult> checkIn({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/attendance/check-in',
        data: {
          'embedding': embedding,
          'latitude': latitude,
          'longitude': longitude,
        },
      );
      return CheckScanResult.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      final message = _messageFrom(e.response?.data);
      if (e.response?.statusCode == 409) {
        throw AlreadyCheckedInException(
          message ?? 'Bugun allaqachon keldingiz belgilangan',
        );
      }
      throw ServerException(message ?? e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<CheckScanResult> checkOut({
    required List<double> embedding,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/attendance/check-out',
        data: {
          'embedding': embedding,
          'latitude': latitude,
          'longitude': longitude,
        },
      );
      return CheckScanResult.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      final message = _messageFrom(e.response?.data);
      final status = e.response?.statusCode;
      if (status == 409) {
        throw AlreadyCheckedOutException(
          message ?? 'Bugun allaqachon ketganingiz belgilangan',
        );
      }
      if (status == 400) {
        throw NotCheckedInException(
          message ?? 'Avval kelganingizni belgilashingiz kerak',
        );
      }
      throw ServerException(message ?? e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<MyAttendance> myAttendance() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/attendance/me',
      );
      return MyAttendance.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      final message = _messageFrom(e.response?.data);
      throw ServerException(message ?? e.message ?? 'Server xatosi');
    }
  }

  /// Backend xato javobi tanasidan (`{message: "..."}`) `uz` tilidagi
  /// xabarni ajratib oladi — topilmasa `null` (chaqiruvchi o'z standart
  /// xabariga tushadi, hech qachon uncaught bo'lmaydi).
  String? _messageFrom(Object? data) {
    if (data is Map<String, dynamic>) {
      final message = data['message'];
      if (message is String) return message;
    }
    return null;
  }
}
