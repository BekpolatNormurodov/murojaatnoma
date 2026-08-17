import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';
import 'package:worker_app/features/points/presentation/bloc/points_cubit.dart';
import 'package:worker_app/features/points/presentation/widgets/points_entry_tile.dart';
import 'package:worker_app/features/points/presentation/widgets/points_hero_card.dart';
import 'package:worker_app/features/points/presentation/widgets/points_summary_row.dart';

/// "Ballarim" (ball nazorati) sahifasi — umumiy ball + reyting o'rni
/// (hero karta), ijobiy/salbiy yig'indi xulosasi va to'liq o'zgarishlar
/// tarixi. `PointsCubit`ning barcha holatlari (yuklanish/bo'sh/xato/
/// yuklandi) shu yerda ko'rsatiladi — hech qachon oq/bo'sh ekran YO'Q.
///
/// Shell tabidan TASHQARIDA, ro'yxatdan (bosh sahifadagi "Tezkor"
/// tugmalari) PUSH qilinadigan to'liq ekranli sahifa — shuning uchun
/// `RequestDetailPage` bilan bir xil naqsh: o'z `AppBar`i + `AppBackButton`.
class PointsPage extends StatelessWidget {
  const PointsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final cubit = context.read<PointsCubit>();

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.pointsPageTitle, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocBuilder<PointsCubit, PointsState>(
          builder: (context, state) => switch (state) {
            PointsLoading() => const _PointsSkeleton(
              key: Key('points_skeleton'),
            ),
            PointsError(:final message) => _PointsErrorView(
              message: message,
              onRetry: cubit.reload,
            ),
            PointsEmpty() => RefreshIndicator(
              onRefresh: cubit.reload,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(vertical: 40),
                children: [
                  EmptyState(
                    icon: AppIcons.coin,
                    title: l10n.pointsEmptyTitle,
                    message: l10n.pointsEmptyMessage,
                  ),
                ],
              ),
            ),
            PointsLoaded(:final points) => _PointsContent(
              points: points,
              onRefresh: cubit.reload,
            ),
          },
        ),
      ),
    );
  }
}

class _PointsContent extends StatelessWidget {
  const _PointsContent({required this.points, required this.onRefresh});

  final WorkerPoints points;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        children: [
          PointsHeroCard(points: points),
          const SizedBox(height: 16),
          PointsSummaryRow(history: points.history),
          const SizedBox(height: 24),
          Text(
            l10n.pointsHistoryTitle,
            style: AppTextStyles.label.copyWith(color: inkSoft),
          ),
          const SizedBox(height: 8),
          AppCard(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
            child: Column(
              children: [
                for (var i = 0; i < points.history.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  PointsEntryTile(entry: points.history[i]),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PointsSkeleton extends StatelessWidget {
  const _PointsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.lg);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSkeleton(
            width: double.infinity,
            height: 150,
            borderRadius: radius,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: AppSkeleton(height: 64, borderRadius: radius),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppSkeleton(height: 64, borderRadius: radius),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const AppSkeleton(width: 100),
          const SizedBox(height: 12),
          AppSkeleton(
            width: double.infinity,
            height: 220,
            borderRadius: radius,
          ),
        ],
      ),
    );
  }
}

class _PointsErrorView extends StatelessWidget {
  const _PointsErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.pointsErrorTitle,
        message: message,
        action: AppButton(
          label: l10n.retry,
          expand: false,
          onPressed: onRetry,
        ),
      ),
    );
  }
}
