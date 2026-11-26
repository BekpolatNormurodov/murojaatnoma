import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';

/// Bitta bildirishnoma qatori — turga mos ikon/rang, sarlavha, matn,
/// nisbiy vaqt va o'qilmagan holat belgisi (chap tomon fon tinti + nuqta).
class NotificationTile extends StatelessWidget {
  const NotificationTile({required this.item, required this.onTap, super.key});

  final NotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (icon, color) = notificationMeta(item.type);
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final unreadTint = isDark
        ? AppColors.primary.withValues(alpha: 0.08)
        : AppColors.primary.withValues(alpha: 0.05);

    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    // Vaqt matn ostida: o'ng ustunda turganda sarlavha so'z o'rtasidan
    // bo'linib ketardi.
    final radius = BorderRadius.circular(AppRadii.md);
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: item.read ? surface : unreadTint,
            borderRadius: radius,
            border: Border.all(
              color: item.read
                  ? line
                  : AppColors.primary.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              NotificationIconBox(icon: icon, color: color),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: AppTextStyles.bodyStrong,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (!item.read) ...[
                          const SizedBox(width: 8),
                          const Padding(
                            padding: EdgeInsets.only(top: 5),
                            child: AppBadge(dot: true),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.body,
                      style: AppTextStyles.caption.copyWith(color: inkSoft),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      relativeTime(context, item.createdAt),
                      style: AppTextStyles.caption.copyWith(
                        fontSize: 12,
                        color: inkMuted,
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
}

/// Turga mos ikonka va rang (ro'yxat va batafsil oynada bir xil).
(IconData, Color) notificationMeta(NotificationType type) => switch (type) {
  NotificationType.paymentSuccess => (AppIcons.tick, AppColors.success),
  NotificationType.paymentFailed => (AppIcons.close, AppColors.danger),
  NotificationType.requestAnswered => (AppIcons.chatBold, AppColors.primary),
  NotificationType.serviceReminder => (AppIcons.receipt, AppColors.warning),
  NotificationType.requestReceived => (AppIcons.requestsBold, AppColors.info),
  NotificationType.requestAssigned => (AppIcons.profileBold, AppColors.info),
  NotificationType.requestResolved => (AppIcons.tick, AppColors.success),
  NotificationType.requestRejected => (AppIcons.close, AppColors.danger),
};

class NotificationIconBox extends StatelessWidget {
  const NotificationIconBox({
    required this.icon,
    required this.color,
    this.size = 44,
    super.key,
  });

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) =>
      AppIconTile(icon: icon, tone: AppToneColors.of(color), size: size);
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
