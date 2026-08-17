import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';

/// Vazifa 15: davomat uchun xotiradagi soxta (mock) "backend" holati.
///
/// `AttendanceRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi (`history`)
/// va yangi check-in yozuvini shu yerga qo'shadi — `AppConfig.useMock`
/// `true` bo'lganda haqiqiy backend o'rnini bosadi. Ilova ishlab turgan
/// davrda xotirada saqlanadi (restart'da boshlang'ich holatga qaytadi).
final List<AttendanceDay> mockAttendanceHistory = [
  const AttendanceDay(
    date: '2026-07-21',
    checkIn: '09:03',
    checkOut: '18:10',
    status: AttendanceStatus.present,
    hours: 9,
    insideGeofence: true,
    selfConfirmed: true,
    confirmedAt: '09:03',
  ),
  const AttendanceDay(
    date: '2026-07-22',
    checkIn: '09:24',
    checkOut: '18:02',
    status: AttendanceStatus.late,
    hours: 8.6,
    insideGeofence: true,
    selfConfirmed: true,
    confirmedAt: '09:24',
  ),
  const AttendanceDay(
    date: '2026-07-23',
    checkIn: null,
    checkOut: null,
    status: AttendanceStatus.absent,
    hours: 0,
    insideGeofence: false,
    selfConfirmed: false,
    confirmedAt: null,
  ),
];
