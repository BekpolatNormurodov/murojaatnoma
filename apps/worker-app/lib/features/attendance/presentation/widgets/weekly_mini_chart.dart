import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';

/// Oxirgi 7 kunlik ish soatlarini animatsion barlar bilan ko'rsatuvchi
/// mini-grafik.
///
/// `fl_chart` emas — brif ikkalasini ham ("fl_chart YOKI oddiy animatsion
/// barlar") teng ravishda qabul qiladi; qo'lda chizilgan barlar qolgan
/// ilova bilan bir xil (`flutter_animate`ga asoslangan) animatsiya
/// uslubini saqlaydi va uchinchi-tomon grafik widget ichki animatsiya
/// controllerlari bilan bog'liq test-barqarorlik xavfini olib tashlaydi.
class WeeklyMiniChart extends StatelessWidget {
  const WeeklyMiniChart({required this.week, super.key});

  final List<AttendanceDay> week;

  static const _chartHeight = 120.0;

  @override
  Widget build(BuildContext context) {
    if (week.isEmpty) return const SizedBox.shrink();

    final maxHours = week.fold<double>(
      1,
      (max, day) => day.hours > max ? day.hours : max,
    );

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.l10n.weeklyChartTitle, style: AppTextStyles.h3),
          const SizedBox(height: 18),
          SizedBox(
            height: _chartHeight,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < week.length; i++)
                  Expanded(
                    child: _DayBar(day: week[i], maxHours: maxHours, index: i),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DayBar extends StatelessWidget {
  const _DayBar({
    required this.day,
    required this.maxHours,
    required this.index,
  });

  final AttendanceDay day;
  final double maxHours;
  final int index;

  Color get _color => switch (day.status) {
    AttendanceStatus.present => AppColors.success,
    AttendanceStatus.late => AppColors.warning,
    AttendanceStatus.absent => AppColors.danger,
    AttendanceStatus.leave => AppColors.accent,
  };

  /// `AttendanceDay.date` ('yyyy-MM-dd') dan oy kunini ajratib oladi —
  /// mahalliy hafta-kuni nomlari uchun `intl` sana-belgi ma'lumotlari
  /// (`initializeDateFormatting`) yuklanishini talab qilmaydi, shuning
  /// uchun har qanday lokalda xavfsiz ishlaydi.
  String get _dayLabel {
    final parts = day.date.split('-');
    return parts.length == 3 ? parts.last : day.date;
  }

  @override
  Widget build(BuildContext context) {
    final heightFactor = maxHours <= 0
        ? 0.0
        : (day.hours / maxHours).clamp(0.0, 1.0);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            day.hours > 0 ? day.hours.toStringAsFixed(0) : '',
            textAlign: TextAlign.center,
            style: AppTextStyles.caption,
          ),
          const SizedBox(height: 4),
          Expanded(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: heightFactor),
                duration: Duration(milliseconds: 500 + index * 60),
                curve: Curves.easeOutCubic,
                builder: (context, value, child) => FractionallySizedBox(
                  heightFactor: value <= 0 ? 0.02 : value,
                  child: Container(
                    decoration: BoxDecoration(
                      // Nol-soatli kunlar QIZIL emas — nozik kulrang chiziq
                      // (qizil "xato"dek ko'rinmasligi uchun).
                      color: day.hours > 0
                          ? _color
                          : mutedColor.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _dayLabel,
            textAlign: TextAlign.center,
            style: AppTextStyles.caption.copyWith(color: mutedColor),
          ),
        ],
      ),
    );
  }
}
