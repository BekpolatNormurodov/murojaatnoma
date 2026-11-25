import 'package:equatable/equatable.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';

/// Xodimning ish vaqti (`GET /attendance/me`). Server qiymati bo'lmasa —
/// standart 09:00–18:00.
class WorkHours extends Equatable {
  const WorkHours({
    this.start = '09:00',
    this.end = '18:00',
    this.isWorkday,
    this.day,
  });

  factory WorkHours.of(MyAttendance me, {DateTime? now}) {
    final at = now ?? DateTime.now();
    return WorkHours(
      start: _minutes(me.workStartTime) == null ? '09:00' : me.workStartTime,
      end: _minutes(me.workEndTime) == null ? '18:00' : me.workEndTime,
      isWorkday: me.isWorkday,
      day: DateTime(at.year, at.month, at.day),
    );
  }

  final String start;
  final String end;

  /// [day] kuni ish kunimi (server); `null` — noma'lum.
  final bool? isWorkday;
  final DateTime? day;

  /// `09:00–18:00`.
  String get label => '$start–$end';

  /// [now] ish vaqti ichidami. Server bugun haqida gapirmagan bo'lsa
  /// yakshanba dam olish kuni hisoblanadi.
  bool contains(DateTime now) {
    final sameDay =
        day != null &&
        day!.year == now.year &&
        day!.month == now.month &&
        day!.day == now.day;
    final working = sameDay && isWorkday != null
        ? isWorkday!
        : now.weekday != DateTime.sunday;
    if (!working) return false;
    final at = now.hour * 60 + now.minute;
    final from = _minutes(start)!;
    final to = _minutes(end)!;
    // Tungi smena (22:00–06:00) yarim tundan o'tadi.
    return from <= to ? at >= from && at < to : at >= from || at < to;
  }

  static int? _minutes(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length < 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    return h == null || m == null ? null : h * 60 + m;
  }

  @override
  List<Object?> get props => [start, end, isWorkday, day];
}
