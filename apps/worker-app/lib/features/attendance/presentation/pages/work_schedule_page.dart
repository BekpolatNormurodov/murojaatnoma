import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Bitta hafta kunining ish jadvalidagi qatori — nomi (`DateTime.weekday`
/// qiymati bilan) va ko'rsatiladigan matn/rasm holatini quruvchi
/// funksiyaga bog'liq (qarang: `_WorkSchedulePageState._rows`).
class _ScheduleDay {
  const _ScheduleDay({
    required this.weekday,
    required this.label,
    required this.isRestDay,
  });

  /// `DateTime.monday`..`DateTime.sunday` (1..7).
  final int weekday;
  final String label;
  final bool isRestDay;
}

/// "Ish jadvali" — bosh sahifadagi "Ish jadvali" tezkor kartasidan PUSH
/// qilinadigan to'liq ekranli sahifa. Haftaning barcha 7 kunini alohida
/// qator sifatida ko'rsatadi (Dushanba–Shanba: 09:00–18:00, Yakshanba: dam
/// olish) — foydalanuvchi ilgari faqat bitta statik "09:00–18:00" yozuvini
/// ko'rar edi, endi har bir kun aniq ko'rinadi. Joriy kun (`DateTime.now()
/// .weekday`) alohida ajratib ko'rsatiladi ("Bugun" belgisi + brend rangli
/// chegara).
class WorkSchedulePage extends StatelessWidget {
  const WorkSchedulePage({super.key});

  static const List<int> _weekdayOrder = [
    DateTime.monday,
    DateTime.tuesday,
    DateTime.wednesday,
    DateTime.thursday,
    DateTime.friday,
    DateTime.saturday,
    DateTime.sunday,
  ];

  List<_ScheduleDay> _rows(AppLocalizations l10n) {
    final names = <int, String>{
      DateTime.monday: l10n.weekdayMonday,
      DateTime.tuesday: l10n.weekdayTuesday,
      DateTime.wednesday: l10n.weekdayWednesday,
      DateTime.thursday: l10n.weekdayThursday,
      DateTime.friday: l10n.weekdayFriday,
      DateTime.saturday: l10n.weekdaySaturday,
      DateTime.sunday: l10n.weekdaySunday,
    };
    return [
      for (final weekday in _weekdayOrder)
        _ScheduleDay(
          weekday: weekday,
          label: names[weekday]!,
          isRestDay: weekday == DateTime.sunday,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final today = DateTime.now().weekday;
    final rows = _rows(l10n);

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.workSchedulePageTitle, style: AppTextStyles.h3),
        centerTitle: false,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final horizontalPadding = constraints.maxWidth > 640
                ? (constraints.maxWidth - 560) / 2
                : 20.0;

            return ListView(
              padding: EdgeInsets.fromLTRB(
                horizontalPadding,
                12,
                horizontalPadding,
                32,
              ),
              children: [
                Text(
                  l10n.workScheduleSubtitle,
                  style: AppTextStyles.body.copyWith(color: mutedColor),
                ),
                const SizedBox(height: 18),
                AppCard(
                  shadow: true,
                  padding: const EdgeInsets.symmetric(
                    vertical: 4,
                    horizontal: 4,
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < rows.length; i++) ...[
                        if (i > 0)
                          Divider(
                            height: 1,
                            color: isDark ? AppColors.darkLine : AppColors.line,
                            indent: 16,
                            endIndent: 16,
                          ),
                        _ScheduleRow(
                              day: rows[i],
                              isToday: rows[i].weekday == today,
                            )
                            .animate(delay: (40 * i).ms)
                            .fadeIn(duration: 250.ms)
                            .slideY(begin: 0.06, end: 0),
                      ],
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Ish jadvali sahifasidagi bitta kun qatori — kun nomi, "Bugun" belgisi
/// (mavjud bo'lsa) va o'ng tomonda soat oralig'i yoki "Dam olish" matni.
/// Bugungi kun brend rangli chap chegara + yumshoq fon bilan ajratiladi.
class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({required this.day, required this.isToday});

  final _ScheduleDay day;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    final valueColor = day.isRestDay ? AppColors.warning : AppColors.primary;
    final valueText = day.isRestDay
        ? l10n.workScheduleRestDay
        : l10n.workScheduleHours;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: isToday ? AppColors.primary.withValues(alpha: 0.08) : null,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: isToday
            ? Border.all(color: AppColors.primary.withValues(alpha: 0.4))
            : null,
      ),
      child: Row(
        children: [
          Icon(
            day.isRestDay ? AppIcons.moon : AppIcons.timer,
            size: 18,
            color: valueColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    day.label,
                    style: AppTextStyles.bodyStrong.copyWith(color: ink),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (isToday) ...[
                  const SizedBox(width: 8),
                  AppBadge(label: l10n.workScheduleTodayBadge),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            valueText,
            style: AppTextStyles.bodyStrong.copyWith(
              color: day.isRestDay ? mutedColor : valueColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
