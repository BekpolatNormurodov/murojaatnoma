import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';

/// `POST /attendance/precheck` javobi — shu joydan "keldi/ketdi" qabul
/// qilinadimi va nega yo'q.
class PrecheckResult {
  const PrecheckResult({
    required this.allowed,
    required this.distanceM,
    required this.message,
    this.place,
    this.radiusM,
    this.mahallaName,
  });

  factory PrecheckResult.fromJson(Map<String, dynamic> json) => PrecheckResult(
    allowed: json['allowed'] == true,
    distanceM: (json['distanceM'] as num?)?.toDouble() ?? 0,
    message: (json['message'] as String?) ?? '',
    place: json['place'] as String?,
    radiusM: (json['radiusM'] as num?)?.toDouble(),
    mahallaName: json['mahallaName'] as String?,
  );

  final bool allowed;

  /// Ofisgacha masofa (m).
  final double distanceM;

  /// Xodimga ko'rsatiladigan tayyor o'zbekcha izoh.
  final String message;

  /// `office` | `zone` | `null` (ruxsat yo'q).
  final String? place;
  final double? radiusM;
  final String? mahallaName;
}

/// "Shu yerdan belgilay olamanmi?" — qarorni SERVER qiladi (xodimning o'z
/// ofisi/radiusi va biriktirilgan mahallalari). Ilovada qattiq yozilgan
/// koordinatalar endi ishlatilmaydi — ular serverdan farq qilib, hech kim
/// "keldi" qila olmasdi.
// Interface (API vs demo implementations, swappable in DI/tests).
// ignore: one_member_abstracts
abstract class AttendancePrecheck {
  /// `null` — server bilan bog'lanib bo'lmadi (oflayn): skanerni ochaveramiz,
  /// yakuniy qarorni server yuborish paytida qiladi.
  Future<PrecheckResult?> check({
    required double latitude,
    required double longitude,
    double? accuracy,
  });
}

class ApiAttendancePrecheck implements AttendancePrecheck {
  ApiAttendancePrecheck(this._client);

  final DioClient _client;

  @override
  Future<PrecheckResult?> check({
    required double latitude,
    required double longitude,
    double? accuracy,
  }) async {
    try {
      final res = await _client.dio.post<Map<String, dynamic>>(
        '/attendance/precheck',
        data: {
          'latitude': latitude,
          'longitude': longitude,
          if (accuracy != null) 'accuracy': accuracy,
        },
      );
      final data = res.data;
      return data == null ? null : PrecheckResult.fromJson(data);
    } on DioException {
      return null;
    }
  }
}

/// Demo (mock) rejim: backend yo'q — mahalliy radius bilan.
class LocalAttendancePrecheck implements AttendancePrecheck {
  LocalAttendancePrecheck([GeofenceService? geofence])
    : _geofence = geofence ?? GeofenceService();

  final GeofenceService _geofence;

  @override
  Future<PrecheckResult?> check({
    required double latitude,
    required double longitude,
    double? accuracy,
  }) async {
    final inside = _geofence.isInside(latitude, longitude);
    return PrecheckResult(
      allowed: inside,
      distanceM: 0,
      place: inside ? 'office' : null,
      message: inside
          ? 'Ish joyidasiz — belgilash mumkin'
          : 'Ish joyingizdan uzoqdasiz',
    );
  }
}

/// Server rad etish sababini ("face score 0.41 below threshold 0.7; 5230m
/// from office, outside 200m geofence") xodim tushunadigan o'zbekchaga
/// aylantiradi.
String humanizeScanReason(String? reason) {
  if (reason == null || reason.trim().isEmpty) return 'Tasdiqlanmadi';
  final parts = <String>[];
  for (final raw in reason.split(';')) {
    final p = raw.trim();
    if (p.isEmpty) continue;
    if (p.contains('no enrolled face')) {
      parts.add("Yuzingiz hali ro'yxatdan o'tkazilmagan");
      continue;
    }
    final face = RegExp(
      r'face score ([\d.]+) below threshold ([\d.]+)',
    ).firstMatch(p);
    if (face != null) {
      final got = ((double.tryParse(face.group(1)!) ?? 0) * 100).round();
      parts.add("Yuz mos kelmadi ($got%). Yorug'roq joyda qayta urining");
      continue;
    }
    final geo = RegExp(
      r'([\d.]+)m from office, outside ([\d.]+)m geofence',
    ).firstMatch(p);
    if (geo != null) {
      final m = double.tryParse(geo.group(1)!) ?? 0;
      final far = m >= 1000
          ? '${(m / 1000).toStringAsFixed(1)} km'
          : '${m.round()} m';
      parts.add(
        p.contains('mahalla')
            ? 'Ofisdan $far uzoqdasiz va biriktirilgan mahallangizda emassiz'
            : 'Ish joyingizdan $far uzoqdasiz (ruxsat ${geo.group(2)} m)',
      );
      continue;
    }
    parts.add(p);
  }
  return parts.join('. ');
}
