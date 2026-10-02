import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';

/// Bir kunlik davomat — "Mening davomatim" sahifasi uchun
/// (`GET /attendance/me/history`): holat, keldi/ketdi vaqti va yuz skan
/// kadrlari (serverda saqlangan isbot).
class AttendanceHistoryDay {
  const AttendanceHistoryDay({
    required this.date,
    required this.status,
    this.checkIn,
    this.checkOut,
    this.isLate = false,
    this.lateMinutes = 0,
    this.checkInPhoto,
    this.checkOutPhoto,
    this.hours,
  });

  factory AttendanceHistoryDay.fromJson(Map<String, dynamic> json) {
    final inJson = json['checkIn'] as Map<String, dynamic>?;
    final outJson = json['checkOut'] as Map<String, dynamic>?;
    return AttendanceHistoryDay(
      date: DateTime.parse(json['date'] as String),
      status: json['status'] as String? ?? 'absent',
      checkIn: _time(inJson?['time']),
      checkOut: _time(outJson?['time']),
      isLate: inJson?['isLate'] as bool? ?? false,
      lateMinutes: (inJson?['lateMinutes'] as num?)?.toInt() ?? 0,
      checkInPhoto: _absolute(inJson?['photoUrl'] as String?),
      checkOutPhoto: _absolute(outJson?['photoUrl'] as String?),
      hours: (json['hoursWorked'] as num?)?.toDouble(),
    );
  }

  /// Mahalliy kun (soatsiz).
  final DateTime date;

  /// present | late | left | absent | leave | dayoff
  final String status;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final bool isLate;
  final int lateMinutes;
  final String? checkInPhoto;
  final String? checkOutPhoto;
  final double? hours;

  bool get came => checkIn != null;
}

// Seam: demo rejim va testlarda soxta manba bilan almashtiriladi.
// ignore: one_member_abstracts
abstract class AttendanceHistorySource {
  /// Eng yangisi birinchi. Xatoda `ServerException`.
  Future<List<AttendanceHistoryDay>> load({int days = 60});
}

class ApiAttendanceHistory implements AttendanceHistorySource {
  ApiAttendanceHistory(this._client);

  final DioClient _client;

  @override
  Future<List<AttendanceHistoryDay>> load({int days = 60}) async {
    try {
      final res = await _client.dio.get<List<dynamic>>(
        '/attendance/me/history',
        queryParameters: {'days': days},
      );
      return (res.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceHistoryDay.fromJson)
          .toList();
    } on DioException catch (e) {
      final data = e.response?.data;
      throw ServerException(
        data is Map<String, dynamic> && data['message'] is String
            ? data['message'] as String
            : "Davomat tarixini yuklab bo'lmadi",
      );
    }
  }
}

/// Demo rejim: ish kunlari keldi (ba'zan kechikib), dam olish kunlari bo'sh.
class MockAttendanceHistory implements AttendanceHistorySource {
  @override
  Future<List<AttendanceHistoryDay>> load({int days = 60}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return [
      for (var i = 0; i < days; i++) _day(today.subtract(Duration(days: i)), i),
    ];
  }

  AttendanceHistoryDay _day(DateTime d, int i) {
    if (d.weekday >= DateTime.saturday) {
      return AttendanceHistoryDay(date: d, status: 'dayoff');
    }
    if (i % 11 == 7) return AttendanceHistoryDay(date: d, status: 'absent');
    final late = i % 6 == 3;
    final inAt = DateTime(d.year, d.month, d.day, late ? 9 : 8, late ? 12 : 50);
    final outAt = i == 0 ? null : DateTime(d.year, d.month, d.day, 18, 4);
    return AttendanceHistoryDay(
      date: d,
      status: i == 0 ? (late ? 'late' : 'present') : 'left',
      checkIn: inAt,
      checkOut: outAt,
      isLate: late,
      lateMinutes: late ? 12 : 0,
      hours: outAt == null ? null : outAt.difference(inAt).inMinutes / 60,
    );
  }
}

DateTime? _time(Object? iso) =>
    iso is String ? DateTime.tryParse(iso)?.toLocal() : null;

/// `/uploads/x.jpg` → `https://murojaatnoma.uz/uploads/x.jpg`.
String? _absolute(String? path) {
  if (path == null || path.trim().isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final uri = Uri.parse(AppConfig.apiBaseUrl);
  final port = uri.hasPort ? ':${uri.port}' : '';
  final origin = '${uri.scheme}://${uri.host}$port';
  return path.startsWith('/') ? '$origin$path' : '$origin/$path';
}
