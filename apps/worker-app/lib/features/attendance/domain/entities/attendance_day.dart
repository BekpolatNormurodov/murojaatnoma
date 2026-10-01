import 'package:equatable/equatable.dart';

/// `leave` — tasdiqlangan ta'til; `dayOff` — ish kuni emas (WORK_DAYS).
enum AttendanceStatus { present, late, absent, leave, dayOff }

class AttendanceDay extends Equatable {
  const AttendanceDay({
    required this.date,
    required this.checkIn,
    required this.checkOut,
    required this.status,
    required this.hours,
    required this.insideGeofence,
    required this.selfConfirmed,
    required this.confirmedAt,
    this.checkInPhotoUrl,
    this.checkOutPhotoUrl,
  });

  factory AttendanceDay.fromJson(Map<String, dynamic> json) {
    return AttendanceDay(
      date: json['date'] as String,
      checkIn: json['check_in'] as String?,
      checkOut: json['check_out'] as String?,
      status: AttendanceStatus.values.byName(json['status'] as String),
      hours: (json['hours'] as num).toDouble(),
      insideGeofence: json['inside_geofence'] as bool,
      selfConfirmed: json['self_confirmed'] as bool,
      confirmedAt: json['confirmed_at'] as String?,
      checkInPhotoUrl: json['check_in_photo'] as String?,
      checkOutPhotoUrl: json['check_out_photo'] as String?,
    );
  }

  final String date;
  final String? checkIn;
  final String? checkOut;
  final AttendanceStatus status;
  final double hours;
  final bool insideGeofence;
  final bool selfConfirmed;
  final String? confirmedAt;

  /// Yuz tekshiruvidan o'tgan kadr (serverda saqlangan) — "kim keldi/ketdi".
  final String? checkInPhotoUrl;
  final String? checkOutPhotoUrl;

  @override
  List<Object?> get props => [
    date,
    checkIn,
    checkOut,
    status,
    hours,
    insideGeofence,
    selfConfirmed,
    confirmedAt,
    checkInPhotoUrl,
    checkOutPhotoUrl,
  ];

  Map<String, dynamic> toJson() => {
    'date': date,
    'check_in': checkIn,
    'check_out': checkOut,
    'status': status.name,
    'hours': hours,
    'inside_geofence': insideGeofence,
    'self_confirmed': selfConfirmed,
    'confirmed_at': confirmedAt,
    'check_in_photo': checkInPhotoUrl,
    'check_out_photo': checkOutPhotoUrl,
  };
}
