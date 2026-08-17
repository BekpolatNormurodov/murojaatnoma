import 'package:equatable/equatable.dart';
import 'package:intl/intl.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';

/// `GET /attendance/me` javobi — joriy xodimning bugungi holati + so'nggi
/// hafta tarixi, BITTA so'rovda.
///
/// Jonli backend kontraktida (yuz tanish serverga ko'chirilgandan keyin)
/// bu — `AttendanceCubit.load()` uchun YAGONA manba: eski
/// `AttendanceRepository.history()` (`GET /attendance/history` — jonli
/// backendda UMUMAN YO'Q) o'rniga ishlatiladi. Shu bois `history()` OLIB
/// TASHLANDI, o'rniga shu klass qo'shildi (qarang: `AttendanceRepository`
/// hujjati).
class MyAttendance extends Equatable {
  const MyAttendance({
    required this.employeeId,
    required this.fullName,
    required this.department,
    required this.workStartTime,
    required this.today,
    required this.week,
  });

  factory MyAttendance.fromJson(Map<String, dynamic> json) {
    final weekJson = json['week'] as List<dynamic>? ?? const [];
    return MyAttendance(
      employeeId: json['employeeId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? '',
      department: json['department'] as String? ?? '',
      workStartTime: json['workStartTime'] as String? ?? '',
      today: dayFromMyAttendanceJson(
        json['today'] as Map<String, dynamic>? ?? const {},
      ),
      week: [
        for (final entry in weekJson)
          dayFromMyAttendanceJson(entry as Map<String, dynamic>),
      ],
    );
  }

  final String employeeId;
  final String fullName;
  final String department;

  /// Masalan `'09:00'` — ish boshlanish vaqti (kechikish shundan
  /// hisoblanadi).
  final String workStartTime;

  /// Bugungi kun — HAR DOIM mavjud (backend uni har bir chaqiruvda
  /// qaytaradi, hattoki hali check-in qilinmagan bo'lsa ham —
  /// `today.checkIn == null` orqali aniqlanadi). `AttendanceCubit` buni
  /// "hali belgilanmagan" (neytral) holatiga aylantirishni O'ZI hal
  /// qiladi — qarang: `AttendanceCubit._loadedStateFor`.
  final AttendanceDay today;

  /// So'nggi hafta yozuvlari — backend qaytargan tartibda (odatda sana
  /// bo'yicha o'suvchi).
  final List<AttendanceDay> week;

  @override
  List<Object?> get props => [
    employeeId,
    fullName,
    department,
    workStartTime,
    today,
    week,
  ];
}

/// `today`/`week` massividagi BITTA kun yozuvini `AttendanceDay`ga
/// aylantiradi.
///
/// `AttendanceDay.fromJson` (eski shakl — `check_in`/`inside_geofence`
/// kabi tekis snake_case kalitlar) dan ATAYLAB MUSTAQIL: bu yerdagi
/// backend shakli butunlay boshqacha (ichma-ich `checkIn: {time, isLate,
/// lateMinutes, insideGeofence?}` obyekti) — ikkalasini bitta
/// `fromJson`ga qo'shib yuborish uni chalkash qilardi va
/// `AttendanceDay.fromJson`ning mavjud round-trip testini buzardi.
AttendanceDay dayFromMyAttendanceJson(Map<String, dynamic> json) {
  final checkInJson = json['checkIn'] as Map<String, dynamic>?;
  final checkOutJson = json['checkOut'] as Map<String, dynamic>?;
  final checkInTime = checkInJson?['time'] as String?;
  final checkOutTime = checkOutJson?['time'] as String?;

  return AttendanceDay(
    date: json['date'] as String? ?? '',
    checkIn: checkInTime == null ? null : _hhmm(checkInTime),
    checkOut: checkOutTime == null ? null : _hhmm(checkOutTime),
    status: _statusFromApi(json['status'] as String?),
    hours: (json['hoursWorked'] as num?)?.toDouble() ?? 0,
    // Faqat `today.checkIn`da bor ("week" kunlarida yo'q backend
    // kontraktiga ko'ra) — yo'q bo'lsa ichkarida deb faraz qilinadi
    // (haftalik ro'yxat/statistika geofence holatini ko'rsatmaydi,
    // qarang: `WeeklyMiniChart`/`_QuickStats` — faqat `status`/`hours`
    // o'qiydi).
    insideGeofence: checkInJson?['insideGeofence'] as bool? ?? true,
    selfConfirmed: checkInTime != null,
    confirmedAt: checkInTime == null ? null : _hhmm(checkInTime),
  );
}

/// Backend `status` (`'present'|'late'|'absent'|'left'`) ni mahalliy
/// `AttendanceStatus`ga xaritalaydi.
///
/// `'left'` — xodim bugungi ish kunini TUGATGAN (check-in VA check-out
/// qilingan) degani. Mahalliy enumda `AttendanceStatus.leave` allaqachon
/// boshqa ma'noda band (ta'til/rasman ruxsat — UI'da alohida accent
/// rangda ko'rsatiladi), shuning uchun bu yerga mos EMAS. Eng yaqin
/// ijobiy holat — `AttendanceStatus.present`ga tushiriladi (`checkOut`
/// maydonining o'zi allaqachon "kuni tugagan"ligini ko'rsatadi).
AttendanceStatus _statusFromApi(String? raw) {
  switch (raw) {
    case 'late':
      return AttendanceStatus.late;
    case 'absent':
      return AttendanceStatus.absent;
    case 'left':
      return AttendanceStatus.present;
    case 'present':
    default:
      return AttendanceStatus.present;
  }
}

/// ISO 8601 vaqt satridan (masalan `2026-08-17T09:03:00.000Z`) mahalliy
/// `HH:mm` matnini chiqaradi — `AttendanceDay.checkIn`/`checkOut` UI'da
/// to'g'ridan-to'g'ri shu formatda ko'rsatiladi (qarang:
/// `TodayStatusCard`). Parslanmasa (kutilmagan shakl) xom satrni
/// qaytaradi — hech qachon uncaught bo'lmaydi.
String _hhmm(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  return DateFormat('HH:mm').format(parsed.toLocal());
}
