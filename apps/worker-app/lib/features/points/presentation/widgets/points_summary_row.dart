import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';

/// Ijobiy va salbiy ball o'zgarishlari yig'indisining qisqa xulosasi —
/// hero kartasi ostida, tarix ro'yxatidan oldin ko'rsatiladi.
class PointsSummaryRow extends StatelessWidget {
  const PointsSummaryRow({required this.history, super.key});

  final List<PointsEntry> history;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final positiveSum = history
        .where((e) => e.positive)
        .fold<int>(0, (sum, e) => sum + e.delta);
    // Manfiy yozuvlarning `delta`si allaqachon manfiy son — qo'shimcha
    // minus belgisi qo'yilmaydi (`PointsEntryTile` bilan bir xil naqsh).
    final negativeSum = history
        .where((e) => !e.positive)
        .fold<int>(0, (sum, e) => sum + e.delta);

    return Row(
      children: [
        Expanded(
          child: _SummaryStat(
            icon: AppIcons.trendUp,
            color: AppColors.success,
            label: l10n.pointsSummaryPositiveLabel,
            value: '+$positiveSum',
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _SummaryStat(
            icon: AppIcons.trendDown,
            color: AppColors.danger,
            label: l10n.pointsSummaryNegativeLabel,
            value: '$negativeSum',
          ),
        ),
      ],
    );
  }
}

class _SummaryStat extends StatelessWidget {
  const _SummaryStat({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;

    return AppCard(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value,
                  style: AppTextStyles.bodyStrong.copyWith(color: color),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  label,
                  style: AppTextStyles.caption.copyWith(color: mutedColor),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
