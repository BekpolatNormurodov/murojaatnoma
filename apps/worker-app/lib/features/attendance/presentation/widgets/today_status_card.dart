import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';

/// Bugungi davomat holatini ko'rsatuvchi karta — status chip (rangli) +
/// (mavjud bo'lsa) kelgan vaqt.
///
/// [today] `null` bo'lishi mumkin — bu ATAYLAB `AttendanceStatus.absent`ga
/// sintez qilinmaydi ("hali check-in qilmadi" ≠ "kelmadi deb belgilandi"),
/// shuning uchun bu holat alohida, neytral rangda (qizil emas) ko'rsatiladi
/// — qarang: `AttendanceCubit._loadedStateFor`.
class TodayStatusCard extends StatelessWidget {
  const TodayStatusCard({required this.today, super.key});

  final AttendanceDay? today;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final visual = _StatusVisual.of(
      l10n,
      today?.status,
      mutedColor: mutedColor,
    );

    return AppCard(
      shadow: true,
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: visual.color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(visual.icon, color: visual.color, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.todayStatusTitle, style: AppTextStyles.caption),
                const SizedBox(height: 2),
                Text(visual.label, style: AppTextStyles.h3),
              ],
            ),
          ),
          if (today?.checkIn case final checkIn?) ...[
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(l10n.checkInTimeLabel, style: AppTextStyles.caption),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(AppIcons.clock, size: 14, color: mutedColor),
                    const SizedBox(width: 4),
                    Text(checkIn, style: AppTextStyles.bodyStrong),
                  ],
                ),
              ],
            ),
          ],
        ],
      ),
    ).animate().fadeIn(duration: 320.ms).slideY(begin: 0.08, end: 0);
  }
}

/// `today`ning holatiga mos label/rang/icon — `status == null` (hali
/// belgilanmagan) uchun ham, `AttendanceStatus`ning har bir qiymati uchun
/// ham. `switch` `AttendanceStatus?` bo'yicha to'liq (exhaustive).
class _StatusVisual {
  const _StatusVisual({
    required this.label,
    required this.color,
    required this.icon,
  });

  factory _StatusVisual.of(
    AppLocalizations l10n,
    AttendanceStatus? status, {
    required Color mutedColor,
  }) {
    return switch (status) {
      null => _StatusVisual(
        label: l10n.notCheckedInYet,
        color: mutedColor,
        icon: AppIcons.timer,
      ),
      AttendanceStatus.present => _StatusVisual(
        label: l10n.attendanceStatusPresent,
        color: AppColors.success,
        icon: AppIcons.tick,
      ),
      AttendanceStatus.late => _StatusVisual(
        label: l10n.attendanceStatusLate,
        color: AppColors.warning,
        icon: AppIcons.clock,
      ),
      AttendanceStatus.absent => _StatusVisual(
        label: l10n.attendanceStatusAbsent,
        color: AppColors.danger,
        icon: AppIcons.close,
      ),
      AttendanceStatus.leave => _StatusVisual(
        label: l10n.attendanceStatusLeave,
        color: AppColors.accent,
        icon: AppIcons.calendar,
      ),
    };
  }

  final String label;
  final Color color;
  final IconData icon;
}
