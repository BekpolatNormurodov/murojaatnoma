import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';

/// "Ballarim" sahifasining hero kartasi — umumiy ball (katta raqam) va
/// (ma'lum bo'lsa) reyting o'rni, brend gradienti fonida.
class PointsHeroCard extends StatelessWidget {
  const PointsHeroCard({required this.points, super.key});

  final WorkerPoints points;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    const onGradient = Colors.white;
    final onGradientSoft = Colors.white.withValues(alpha: 0.85);

    return AppCard(
      gradient: AppColors.cardGradient,
      shadow: true,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(AppIcons.coin, color: onGradient, size: 18),
              const SizedBox(width: 8),
              Text(
                l10n.pointsTotalLabel,
                style: AppTextStyles.label.copyWith(color: onGradientSoft),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${points.total}',
                style: AppTextStyles.h1.copyWith(
                  color: onGradient,
                  fontSize: 42,
                  height: 1,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  l10n.pointsSuffix,
                  style: AppTextStyles.body.copyWith(color: onGradientSoft),
                ),
              ),
            ],
          ),
          if (points.rank case final rank?) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 7,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(AppRadii.sm),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(AppIcons.crown, size: 15, color: onGradient),
                  const SizedBox(width: 6),
                  Text(
                    l10n.pointsRankLabel(rank),
                    style: AppTextStyles.label.copyWith(color: onGradient),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
