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

    final day = today;
    final hasScans =
        day != null &&
        (day.checkInPhotoUrl != null || day.checkOutPhotoUrl != null);

    return AppCard(
      shadow: true,
      child: Column(
        children: [
          Row(
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
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.todayStatusTitle, style: AppTextStyles.caption),
                    const SizedBox(height: 2),
                    Text(
                      visual.label,
                      style: AppTextStyles.h3,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
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
          // Yuz tekshiruvidan o'tgan kadrlar — serverda saqlangan isbot.
          if (hasScans) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                if (day.checkInPhotoUrl case final url?)
                  Expanded(
                    child: _ScanShot(
                      url: url,
                      label: _t(context, 'Keldi', 'Приход'),
                      time: day.checkIn,
                    ),
                  ),
                if (day.checkInPhotoUrl != null && day.checkOutPhotoUrl != null)
                  const SizedBox(width: 10),
                if (day.checkOutPhotoUrl case final url?)
                  Expanded(
                    child: _ScanShot(
                      url: url,
                      label: _t(context, 'Ketdi', 'Уход'),
                      time: day.checkOut,
                    ),
                  ),
                if (day.checkInPhotoUrl == null || day.checkOutPhotoUrl == null)
                  const Spacer(),
              ],
            ),
          ],
        ],
      ),
    ).animate().fadeIn(duration: 320.ms).slideY(begin: 0.08, end: 0);
  }
}

String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;

/// Bitta skan kadri: kichik rasm + "Keldi 09:02 · yuz tasdiqlandi";
/// bosilsa to'liq o'lchamda ochiladi.
class _ScanShot extends StatelessWidget {
  const _ScanShot({required this.url, required this.label, this.time});

  final String url;
  final String label;
  final String? time;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceAlt = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final caption = time == null ? label : '$label $time';
    return Semantics(
      button: true,
      label: '$caption, skan rasmi',
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.sm),
        onTap: () => _open(context, caption),
        child: Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: surfaceAlt,
            borderRadius: BorderRadius.circular(AppRadii.sm),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  url,
                  width: 40,
                  height: 40,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => SizedBox(
                    width: 40,
                    height: 40,
                    child: Icon(AppIcons.imageIcon, size: 18, color: inkMuted),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyStrong.copyWith(fontSize: 13),
                    ),
                    Text(
                      _t(context, 'Yuz tasdiqlandi', 'Лицо подтверждено'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 11.5,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _open(BuildContext context, String caption) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        clipBehavior: Clip.antiAlias,
        insetPadding: const EdgeInsets.all(24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: InteractiveViewer(
                child: Image.network(url, fit: BoxFit.cover),
              ),
            ),
            ListTile(
              title: Text(caption, style: AppTextStyles.bodyStrong),
              subtitle: Text(
                _t(ctx, 'Yuz tekshiruvi kadri', 'Кадр проверки лица'),
              ),
              trailing: IconButton(
                tooltip: _t(ctx, 'Yopish', 'Закрыть'),
                onPressed: () => Navigator.of(ctx).pop(),
                icon: const Icon(AppIcons.close),
              ),
            ),
          ],
        ),
      ),
    );
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
      AttendanceStatus.dayOff => _StatusVisual(
        label: l10n.localeName == 'ru' ? 'Выходной' : 'Dam olish kuni',
        color: mutedColor,
        icon: AppIcons.calendar,
      ),
    };
  }

  final String label;
  final Color color;
  final IconData icon;
}
