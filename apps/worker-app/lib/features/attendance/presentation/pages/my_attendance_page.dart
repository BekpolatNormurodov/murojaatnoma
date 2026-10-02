import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/attendance/data/attendance_history.dart';
import 'package:worker_app/injection.dart';

/// "Mening davomatim" — xodimning o'z keldi-ketdi tarixi: bu oy xulosasi,
/// oy kalendari (rangli kunlar) va kunlar ro'yxati. Kun bosilsa — keldi/ketdi
/// vaqti va yuz tekshiruvi kadrlari (serverda saqlangan isbot).
class MyAttendancePage extends StatefulWidget {
  const MyAttendancePage({super.key});

  @override
  State<MyAttendancePage> createState() => _MyAttendancePageState();
}

class _MyAttendancePageState extends State<MyAttendancePage> {
  late Future<List<AttendanceHistoryDay>> _future = _load();

  Future<List<AttendanceHistoryDay>> _load() =>
      getIt<AttendanceHistorySource>().load();

  Future<void> _refresh() async {
    final f = _load();
    setState(() => _future = f);
    await f.catchError((Object _) => const <AttendanceHistoryDay>[]);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(_t(context, 'Mening davomatim', 'Моя посещаемость')),
      ),
      body: SafeArea(
        child: FutureBuilder<List<AttendanceHistoryDay>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const _Skeleton();
            }
            if (snap.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: EmptyState(
                    icon: AppIcons.calendar,
                    title: _t(
                      context,
                      "Yuklab bo'lmadi",
                      'Не удалось загрузить',
                    ),
                    message: snap.error is ServerException
                        ? (snap.error! as ServerException).message
                        : _t(
                            context,
                            'Internetni tekshiring',
                            'Проверьте интернет',
                          ),
                    action: AppButton(
                      label: _t(context, 'Qayta urinish', 'Повторить'),
                      expand: false,
                      onPressed: _refresh,
                    ),
                  ),
                ),
              );
            }
            final days = snap.data ?? const [];
            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                children: [
                  _MonthSummary(days: days),
                  const SizedBox(height: 16),
                  _MonthCalendar(days: days),
                  const SizedBox(height: 22),
                  _SectionLabel(_t(context, 'Kunlar', 'Дни')),
                  const SizedBox(height: 8),
                  for (final d in days.where((d) => d.status != 'dayoff'))
                    _DayTile(day: d),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/* ───────────────────────── Xulosa ───────────────────────── */

class _MonthSummary extends StatelessWidget {
  const _MonthSummary({required this.days});

  final List<AttendanceHistoryDay> days;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final month = days
        .where((d) => d.date.year == now.year && d.date.month == now.month)
        .toList();
    final workdays = month.where(
      (d) => d.status != 'dayoff' && d.status != 'leave',
    );
    final came = month.where((d) => d.came).length;
    final late = month.where((d) => d.isLate).length;
    final hours = month.fold<double>(0, (s, d) => s + (d.hours ?? 0));
    final rate = workdays.isEmpty ? 0 : (came / workdays.length * 100).round();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        boxShadow: AppColors.glowShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_monthName(context, now.month)} ${now.year}',
            style: AppTextStyles.caption.copyWith(
              color: Colors.white.withValues(alpha: 0.85),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$rate%',
                style: AppTextStyles.h1.copyWith(
                  color: Colors.white,
                  fontSize: 34,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  _t(context, 'davomat', 'посещаемость'),
                  style: AppTextStyles.body.copyWith(
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              _Stat(value: '$came', label: _t(context, 'kelgan kun', 'дней')),
              _Stat(
                value: '$late',
                label: _t(context, 'kechikish', 'опозданий'),
              ),
              _Stat(
                value: hours.toStringAsFixed(hours >= 100 ? 0 : 1),
                label: _t(context, 'soat', 'часов'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: AppTextStyles.h3.copyWith(color: Colors.white)),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.caption.copyWith(
                color: Colors.white.withValues(alpha: 0.85),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ───────────────────────── Kalendar ───────────────────────── */

class _MonthCalendar extends StatelessWidget {
  const _MonthCalendar({required this.days});

  final List<AttendanceHistoryDay> days;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final now = DateTime.now();
    final first = DateTime(now.year, now.month);
    final daysInMonth = DateTime(now.year, now.month + 1, 0).day;
    final lead = first.weekday - 1; // Dushanbadan boshlanadi
    final byDay = {
      for (final d in days)
        if (d.date.year == now.year && d.date.month == now.month) d.date.day: d,
    };
    final weekdays = _t(
      context,
      'Du Se Ch Pa Ju Sh Ya',
      'Пн Вт Ср Чт Пт Сб Вс',
    ).split(' ');

    return AppCard(
      child: Column(
        children: [
          Row(
            children: [
              for (final w in weekdays)
                Expanded(
                  child: Center(
                    child: Text(
                      w,
                      style: AppTextStyles.caption.copyWith(
                        color: inkMuted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            children: [
              for (var i = 0; i < lead; i++) const SizedBox.shrink(),
              for (var day = 1; day <= daysInMonth; day++)
                _CalendarCell(
                  day: day,
                  entry: byDay[day],
                  future: day > now.day,
                  today: day == now.day,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              _Legend(AppColors.success, _t(context, "O'z vaqtida", 'Вовремя')),
              _Legend(AppColors.warning, _t(context, 'Kechikkan', 'Опоздание')),
              _Legend(AppColors.danger, _t(context, 'Kelmagan', 'Отсутствие')),
              _Legend(AppColors.info, _t(context, "Ta'til", 'Отпуск')),
            ],
          ),
        ],
      ),
    );
  }
}

class _CalendarCell extends StatelessWidget {
  const _CalendarCell({
    required this.day,
    required this.entry,
    required this.future,
    required this.today,
  });

  final int day;
  final AttendanceHistoryDay? entry;
  final bool future;
  final bool today;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final color = future || entry == null ? null : _statusColor(entry!);
    final e = entry;
    return Semantics(
      button: e != null && !future,
      label: '$day',
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: e == null || future ? null : () => _showDay(context, e),
        child: Container(
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color?.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: today ? AppColors.primary : (color ?? line),
              width: today ? 2 : 1,
            ),
          ),
          child: Text(
            '$day',
            style: AppTextStyles.bodyStrong.copyWith(
              fontSize: 13,
              color: color ?? inkMuted,
            ),
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.color, this.label);

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
          ),
        ),
      ],
    );
  }
}

/* ───────────────────────── Kunlar ───────────────────────── */

class _DayTile extends StatelessWidget {
  const _DayTile({required this.day});

  final AttendanceHistoryDay day;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final color = _statusColor(day);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppCard(
        padding: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.md),
          onTap: () => _showDay(context, day),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                SizedBox(
                  width: 46,
                  child: Column(
                    children: [
                      Text(
                        '${day.date.day}',
                        style: AppTextStyles.h3.copyWith(height: 1.1),
                      ),
                      Text(
                        _weekday(context, day.date.weekday),
                        style: AppTextStyles.caption.copyWith(color: inkMuted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppChip(label: _statusLabel(context, day), color: color),
                      const SizedBox(height: 6),
                      Text(
                        day.came
                            ? '${_hm(day.checkIn)} → ${_hm(day.checkOut)}'
                                  '${day.hours != null ? ' · ${day.hours!.toStringAsFixed(1)} soat' : ''}'
                            : '—',
                        style: AppTextStyles.caption.copyWith(
                          color: isDark
                              ? AppColors.darkInkSoft
                              : AppColors.inkSoft,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                for (final url in [day.checkInPhoto, day.checkOutPhoto])
                  if (url != null)
                    Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          url,
                          width: 36,
                          height: 36,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const SizedBox(width: 36),
                        ),
                      ),
                    ),
                Icon(AppIcons.arrowRight, size: 18, color: inkMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Kun tafsiloti: keldi va ketdi — vaqt, kechikish va yuz kadri.
void _showDay(BuildContext context, AttendanceHistoryDay d) {
  showAppSheet<void>(
    context: context,
    title:
        '${d.date.day} ${_monthName(context, d.date.month)}, ${_weekday(context, d.date.weekday)}',
    subtitle: _statusLabel(context, d),
    scrollable: true,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _ScanCard(
                title: _t(context, 'Keldi', 'Приход'),
                time: d.checkIn,
                photo: d.checkInPhoto,
                note: d.isLate
                    ? _t(
                        context,
                        '${d.lateMinutes} daq kechikdi',
                        'Опоздание ${d.lateMinutes} мин',
                      )
                    : (d.came ? _t(context, "O'z vaqtida", 'Вовремя') : null),
                warn: d.isLate,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ScanCard(
                title: _t(context, 'Ketdi', 'Уход'),
                time: d.checkOut,
                photo: d.checkOutPhoto,
                note: d.hours != null
                    ? _t(
                        context,
                        '${d.hours!.toStringAsFixed(1)} soat ishladi',
                        '${d.hours!.toStringAsFixed(1)} ч работы',
                      )
                    : (d.came
                          ? _t(context, 'Hali ishda', 'Ещё на работе')
                          : null),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
      ],
    ),
  );
}

class _ScanCard extends StatelessWidget {
  const _ScanCard({
    required this.title,
    required this.time,
    this.photo,
    this.note,
    this.warn = false,
  });

  final String title;
  final DateTime? time;
  final String? photo;
  final String? note;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: photo == null
                  ? ColoredBox(
                      color: isDark ? AppColors.darkLine : AppColors.line,
                      child: Icon(AppIcons.scan, color: inkMuted, size: 30),
                    )
                  : InteractiveViewer(
                      child: Image.network(
                        photo!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) =>
                            Icon(AppIcons.imageIcon, color: inkMuted),
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Text(title, style: AppTextStyles.caption.copyWith(color: inkMuted)),
          Text(_hm(time), style: AppTextStyles.h3),
          if (note != null)
            Text(
              note!,
              style: AppTextStyles.caption.copyWith(
                color: warn ? AppColors.warning : AppColors.success,
                fontWeight: FontWeight.w600,
              ),
            ),
          if (photo == null && time != null)
            Text(
              _t(context, 'Rasm saqlanmagan', 'Фото нет'),
              style: AppTextStyles.caption.copyWith(
                color: inkMuted,
                fontSize: 11,
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      label,
      style: AppTextStyles.label.copyWith(
        color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      children: const [
        AppSkeleton(height: 150),
        SizedBox(height: 16),
        AppSkeleton(height: 300),
        SizedBox(height: 16),
        AppSkeleton(height: 70),
        SizedBox(height: 8),
        AppSkeleton(height: 70),
      ],
    );
  }
}

/* ───────────────────────── yordamchilar ───────────────────────── */

Color _statusColor(AttendanceHistoryDay d) => switch (d.status) {
  'absent' => AppColors.danger,
  'leave' => AppColors.info,
  'dayoff' => AppColors.inkMuted,
  _ => d.isLate ? AppColors.warning : AppColors.success,
};

String _statusLabel(BuildContext context, AttendanceHistoryDay d) =>
    switch (d.status) {
      'absent' => _t(context, 'Kelmagan', 'Отсутствие'),
      'leave' => _t(context, "Ta'tilda", 'Отпуск'),
      'dayoff' => _t(context, 'Dam olish', 'Выходной'),
      _ =>
        d.isLate
            ? _t(context, 'Kechikkan', 'Опоздание')
            : _t(context, "O'z vaqtida", 'Вовремя'),
    };

String _hm(DateTime? t) => t == null
    ? '—'
    : '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

String _weekday(BuildContext context, int weekday) => _t(
  context,
  const ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'][weekday - 1],
  const ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][weekday - 1],
);

String _monthName(BuildContext context, int month) => _t(
  context,
  const [
    'yanvar',
    'fevral',
    'mart',
    'aprel',
    'may',
    'iyun',
    'iyul',
    'avgust',
    'sentabr',
    'oktabr',
    'noyabr',
    'dekabr',
  ][month - 1],
  const [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
  ][month - 1],
);

String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;
