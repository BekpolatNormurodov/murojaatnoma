import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';

/// Bitta bildirishnoma qatori — turga mos ikon/rang, sarlavha, matn,
/// nisbiy vaqt va o'qilmagan holat belgisi (chap tomon fon tinti + nuqta).
class NotificationTile extends StatelessWidget {
  const NotificationTile({required this.item, required this.onTap, super.key});

  final NotificationItem item;
  final VoidCallback onTap;

  (IconData, Color) _meta(NotificationType type) => switch (type) {
    NotificationType.checkInReminder => (
      IconsaxPlusBold.timer_1,
      AppColors.warning,
    ),
    NotificationType.requestAssigned => (
      AppIcons.requestsBold,
      AppColors.primary,
    ),
    NotificationType.meetingSoon => (AppIcons.videoBold, AppColors.info),
    NotificationType.leaveStatus => (AppIcons.tick, AppColors.success),
    NotificationType.general => (
      IconsaxPlusBold.notification,
      AppColors.accent,
    ),
    NotificationType.locationAlert => (AppIcons.locationBold, AppColors.danger),
  };

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (icon, color) = _meta(item.type);
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final unreadTint = isDark
        ? AppColors.primary.withValues(alpha: 0.08)
        : AppColors.primary.withValues(alpha: 0.05);
    final unreadBorder = AppColors.primary.withValues(alpha: 0.35);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      decoration: BoxDecoration(
        color: item.read ? surface : unreadTint,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: item.read ? line : unreadBorder),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.md),
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          // Vaqt matn OSTIDA: yonida turganda tor ekran / katta shriftda
          // sarlavha so'z o'rtasidan bo'linib kesilardi.
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppIconTile(
                  icon: icon,
                  tone: AppToneColors.of(color),
                  size: 44,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: AppTextStyles.bodyStrong,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.body,
                        style: AppTextStyles.caption.copyWith(
                          color: isDark
                              ? AppColors.darkInkSoft
                              : AppColors.inkSoft,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        relativeTime(context, item.createdAt),
                        style: AppTextStyles.caption.copyWith(
                          color: isDark
                              ? AppColors.darkInkMuted
                              : AppColors.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!item.read) ...[
                  const SizedBox(width: 10),
                  const AppBadge(dot: true),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Berilgan vaqtni joriy vaqtga nisbatan qisqa matnga aylantiradi (masalan
/// "12 daqiqa oldin"). Sof funksiya — hech qachon `null`/xato qaytarmaydi.
String relativeTime(BuildContext context, DateTime time) {
  final l10n = context.l10n;
  final diff = DateTime.now().difference(time);
  if (diff.inMinutes < 1) return l10n.notificationsJustNow;
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes} ${l10n.notificationsMinutesAgoSuffix}';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours} ${l10n.notificationsHoursAgoSuffix}';
  }
  return '${diff.inDays} ${l10n.notificationsDaysAgoSuffix}';
}
