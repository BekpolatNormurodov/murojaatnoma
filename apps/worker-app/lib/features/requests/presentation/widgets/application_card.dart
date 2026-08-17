import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/presentation/widgets/status_chip.dart';

/// `Application.createdAt`/`deadline` kabi ISO sana satrlarini
/// (`formatDate` yordamida) inson o'qiy oladigan ko'rinishga o'giradi;
/// parslab bo'lmasa xom satrni qaytaradi (mock ma'lumotlar doim to'g'ri
/// formatda, lekin himoya sifatida).
String formatIsoDate(String iso) {
  final parsed = DateTime.tryParse(iso);
  return parsed == null ? iso : formatDate(parsed);
}

/// [formatIsoDate] bilan bir xil, lekin soat:daqiqani ham qo'shadi —
/// javob berilgan payt kabi to'liq vaqt muhim bo'lgan joylarda.
String formatIsoDateTime(String iso) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  final hh = parsed.hour.toString().padLeft(2, '0');
  final mm = parsed.minute.toString().padLeft(2, '0');
  return '${formatDate(parsed)}, $hh:$mm';
}

/// Ro'yxatdagi bitta murojaat kartasi — sarlavha, kategoriya, holat
/// chipi ([StatusChip]), muhimlik darajasi ([AppBadge]) va ball/sana.
class ApplicationCard extends StatelessWidget {
  const ApplicationCard({required this.application, super.key, this.onTap});

  final Application application;
  final VoidCallback? onTap;

  static AppBadgeVariant priorityVariant(ApplicationPriority priority) =>
      switch (priority) {
        ApplicationPriority.past => AppBadgeVariant.neutral,
        ApplicationPriority.orta => AppBadgeVariant.warning,
        ApplicationPriority.yuqori => AppBadgeVariant.danger,
      };

  static String priorityLabel(
    BuildContext context,
    ApplicationPriority priority,
  ) {
    final l10n = context.l10n;
    return switch (priority) {
      ApplicationPriority.past => l10n.priorityPast,
      ApplicationPriority.orta => l10n.priorityOrta,
      ApplicationPriority.yuqori => l10n.priorityYuqori,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  application.title,
                  style: AppTextStyles.bodyStrong,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 10),
              StatusChip(status: application.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            application.category,
            style: AppTextStyles.caption.copyWith(color: inkSoft),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              AppBadge(
                label: priorityLabel(context, application.priority),
                variant: priorityVariant(application.priority),
              ),
              if (application.points > 0) ...[
                const SizedBox(width: 10),
                const Icon(AppIcons.coin, size: 14, color: AppColors.warning),
                const SizedBox(width: 4),
                Text(
                  '${application.points} ${l10n.pointsSuffix}',
                  style: AppTextStyles.caption.copyWith(
                    color: inkSoft,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const Spacer(),
              Icon(AppIcons.calendar, size: 14, color: inkMuted),
              const SizedBox(width: 4),
              Text(
                formatIsoDate(application.createdAt),
                style: AppTextStyles.caption.copyWith(color: inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
