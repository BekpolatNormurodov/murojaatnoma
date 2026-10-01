import 'package:equatable/equatable.dart';

/// `GET /me/dashboard` — xodimning bosh sahifa ko'rsatkichlari (bitta so'rov).
class MyDashboard extends Equatable {
  const MyDashboard({
    required this.attendance,
    required this.murojaat,
    required this.money,
    required this.today,
    required this.recent,
  });

  factory MyDashboard.fromJson(Map<String, dynamic> j) => MyDashboard(
    attendance: AttendanceKpi.fromJson(_map(j['attendance'])),
    murojaat: MurojaatKpi.fromJson(_map(j['murojaat'])),
    money: MoneyKpi.fromJson(_map(j['money'])),
    today: TodayKpi.fromJson(_map(j['today'])),
    recent: [
      for (final e in (j['recent'] as List<dynamic>? ?? const []))
        ActivityItem.fromJson(_map(e)),
    ],
  );

  final AttendanceKpi attendance;
  final MurojaatKpi murojaat;
  final MoneyKpi money;
  final TodayKpi today;
  final List<ActivityItem> recent;

  @override
  List<Object?> get props => [attendance, murojaat, money, today, recent];
}

Map<String, dynamic> _map(Object? o) =>
    o is Map<String, dynamic> ? o : const <String, dynamic>{};
int _int(Object? o) => (o as num?)?.toInt() ?? 0;
double? _dbl(Object? o) => (o as num?)?.toDouble();

class AttendanceKpi extends Equatable {
  const AttendanceKpi({
    required this.totalHours,
    required this.daysPresent,
    required this.daysLate,
    required this.workDaysSoFar,
    required this.onTimeRate,
    required this.attendanceRate,
    required this.avgCheckIn,
    required this.onTimeStreak,
    required this.rank,
    required this.rankOf,
    required this.last30,
  });

  factory AttendanceKpi.fromJson(Map<String, dynamic> j) => AttendanceKpi(
    totalHours: _dbl(j['totalHours']) ?? 0,
    daysPresent: _int(j['daysPresent']),
    daysLate: _int(j['daysLate']),
    workDaysSoFar: _int(j['workDaysSoFar']),
    onTimeRate: (j['onTimeRate'] as num?)?.toInt(),
    attendanceRate: (j['attendanceRate'] as num?)?.toInt(),
    avgCheckIn: j['avgCheckIn'] as String?,
    onTimeStreak: _int(j['onTimeStreak']),
    rank: (j['rank'] as num?)?.toInt(),
    rankOf: _int(j['rankOf']),
    last30: [
      for (final d in (j['last30'] as List<dynamic>? ?? const []))
        DayCell.fromJson(_map(d)),
    ],
  );

  final double totalHours;
  final int daysPresent;
  final int daysLate;
  final int workDaysSoFar;
  final int? onTimeRate;
  final int? attendanceRate;
  final String? avgCheckIn;
  final int onTimeStreak;
  final int? rank;
  final int rankOf;
  final List<DayCell> last30;

  @override
  List<Object?> get props => [
    totalHours,
    daysPresent,
    daysLate,
    workDaysSoFar,
    onTimeRate,
    attendanceRate,
    avgCheckIn,
    onTimeStreak,
    rank,
    rankOf,
    last30,
  ];
}

class DayCell extends Equatable {
  const DayCell({
    required this.date,
    required this.present,
    required this.late,
    required this.hours,
  });

  factory DayCell.fromJson(Map<String, dynamic> j) => DayCell(
    date: DateTime.tryParse(j['date'] as String? ?? '') ?? DateTime(2000),
    present: j['present'] == true,
    late: j['late'] == true,
    hours: _dbl(j['hours']) ?? 0,
  );

  final DateTime date;
  final bool present;
  final bool late;
  final double hours;

  @override
  List<Object?> get props => [date, present, late, hours];
}

class MurojaatKpi extends Equatable {
  const MurojaatKpi({
    required this.open,
    required this.newToday,
    required this.overdue,
    required this.resolvedThisMonth,
    required this.avgResolutionHours,
    required this.avgRating,
    required this.ratedCount,
  });

  factory MurojaatKpi.fromJson(Map<String, dynamic> j) => MurojaatKpi(
    open: _int(j['open']),
    newToday: _int(j['newToday']),
    overdue: _int(j['overdue']),
    resolvedThisMonth: _int(j['resolvedThisMonth']),
    avgResolutionHours: _dbl(j['avgResolutionHours']),
    avgRating: _dbl(j['avgRating']),
    ratedCount: _int(j['ratedCount']),
  );

  final int open;
  final int newToday;
  final int overdue;
  final int resolvedThisMonth;
  final double? avgResolutionHours;
  final double? avgRating;
  final int ratedCount;

  @override
  List<Object?> get props => [
    open,
    newToday,
    overdue,
    resolvedThisMonth,
    avgResolutionHours,
    avgRating,
    ratedCount,
  ];
}

class MoneyKpi extends Equatable {
  const MoneyKpi({
    required this.salaryNet,
    required this.premyaThisMonth,
    required this.points,
  });

  factory MoneyKpi.fromJson(Map<String, dynamic> j) => MoneyKpi(
    salaryNet: (j['salaryNet'] as num?)?.toInt(),
    premyaThisMonth: _int(j['premyaThisMonth']),
    points: _int(j['points']),
  );

  final int? salaryNet;
  final int premyaThisMonth;
  final int points;

  @override
  List<Object?> get props => [salaryNet, premyaThisMonth, points];
}

class TodayKpi extends Equatable {
  const TodayKpi({
    required this.meetings,
    required this.unreadChat,
    required this.unreadNotifications,
  });

  factory TodayKpi.fromJson(Map<String, dynamic> j) => TodayKpi(
    meetings: _int(j['meetings']),
    unreadChat: _int(j['unreadChat']),
    unreadNotifications: _int(j['unreadNotifications']),
  );

  final int meetings;
  final int unreadChat;
  final int unreadNotifications;

  @override
  List<Object?> get props => [meetings, unreadChat, unreadNotifications];
}

class ActivityItem extends Equatable {
  const ActivityItem({
    required this.title,
    required this.body,
    required this.type,
    required this.createdAt,
    required this.isRead,
  });

  factory ActivityItem.fromJson(Map<String, dynamic> j) => ActivityItem(
    title: j['title'] as String? ?? '',
    body: j['body'] as String? ?? '',
    type: j['type'] as String? ?? 'GENERAL',
    createdAt:
        DateTime.tryParse(j['createdAt'] as String? ?? '') ?? DateTime.now(),
    isRead: j['isRead'] == true,
  );

  final String title;
  final String body;

  /// GENERAL | ATTENDANCE | APPLICATION | LOCATION
  final String type;
  final DateTime createdAt;
  final bool isRead;

  @override
  List<Object?> get props => [title, body, type, createdAt, isRead];
}
