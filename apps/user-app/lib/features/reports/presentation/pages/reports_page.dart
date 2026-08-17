import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/features/reports/presentation/bloc/reports_cubit.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/widgets/request_status_chip.dart';

/// "Hisobot" sahifasi — fuqaroning faoliyati bo'yicha yengil jamlanma
/// ko'rinish: to'lovlar soni/summasi va arizalar/shikoyatlar soni (holat
/// bo'yicha taqsimot bilan). Profil sahifasidan ochiladi.
class ReportsPage extends StatelessWidget {
  const ReportsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.reportsPageTitle, style: AppTextStyles.h3),
      ),
      body: SafeArea(
        child: BlocBuilder<ReportsCubit, ReportsState>(
          builder: (context, state) => switch (state) {
            ReportsLoading() => const _ReportsSkeleton(
              key: Key('reports_skeleton'),
            ),
            ReportsError(:final message) => Padding(
              padding: const EdgeInsets.all(24),
              child: EmptyState(
                icon: AppIcons.close,
                title: l10n.dataLoadErrorTitle,
                message: message,
                action: AppButton(
                  label: l10n.retry,
                  expand: false,
                  onPressed: () => context.read<ReportsCubit>().load(),
                ),
              ),
            ),
            ReportsLoaded(:final summary) => _ReportsContent(summary: summary),
          },
        ),
      ),
    );
  }
}

class _ReportsContent extends StatelessWidget {
  const _ReportsContent({required this.summary});

  final ReportsSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final arizaCount = summary.requestsCountByKind[RequestKind.ariza] ?? 0;
    final shikoyatCount =
        summary.requestsCountByKind[RequestKind.shikoyat] ?? 0;

    return RefreshIndicator(
      onRefresh: () => context.read<ReportsCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Row(
            // Ikkala karta baland-pastligidan qat'i nazar bir xil
            // balandlikda bo'lib, ustki/ostki qirralari tekis tursin
            // (masalan biror yorliq/qiymat ikki qatorga o'tsa ham).
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _StatCard(
                  icon: AppIcons.receipt,
                  color: AppColors.primary,
                  label: l10n.reportsPaymentsCountLabel,
                  value: '${summary.paymentsCount}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: AppIcons.moneyReceive,
                  color: AppColors.accent,
                  label: l10n.reportsPaymentsAmountLabel,
                  value: formatSom(summary.paymentsTotalAmount),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _StatCard(
                  icon: AppIcons.documentUpload,
                  color: AppColors.accentDark,
                  label: l10n.reportsAppealsCountLabel,
                  value: '$arizaCount',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: IconsaxPlusLinear.warning_2,
                  color: AppColors.warning,
                  label: l10n.reportsComplaintsCountLabel,
                  value: '$shikoyatCount',
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(l10n.reportsByStatusTitle, style: AppTextStyles.h3),
          const SizedBox(height: 12),
          AppCard(
            child: Column(
              children: [
                for (final status in RequestStatus.values)
                  _StatusRow(
                    status: status,
                    count: summary.requestsCountByStatus[status] ?? 0,
                    total: summary.totalRequests,
                  ),
              ],
            ),
          ),
        ],
      ).animate().fadeIn(duration: 250.ms),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
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
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, color: color, size: 19),
          ),
          const SizedBox(height: 12),
          // Katta so'm summasi (masalan "12 500 000 so'm") kartaning yarim
          // kengligiga sig'masa, o'rtasidan kesilib qolmasin — bitta
          // qatorda sig'guncha kichrayadi (ellipsis emas, scaleDown).
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: AppTextStyles.h2,
              maxLines: 1,
              softWrap: false,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(color: inkMuted),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.status,
    required this.count,
    required this.total,
  });

  final RequestStatus status;
  final int count;
  final int total;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final color = RequestStatusChip.colorOf(status);
    final fraction = total == 0 ? 0.0 : count / total;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  RequestStatusChip.labelOf(context, status),
                  style: AppTextStyles.bodyStrong,
                ),
              ),
              Text(
                '$count',
                style: AppTextStyles.bodyStrong.copyWith(color: color),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: SizedBox(
              height: 8,
              child: Stack(
                children: [
                  ColoredBox(color: line),
                  FractionallySizedBox(
                    widthFactor: fraction.clamp(0, 1),
                    child: ColoredBox(color: color),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportsSkeleton extends StatelessWidget {
  const _ReportsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(AppRadii.lg);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: AppSkeleton(height: 110, borderRadius: radius),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppSkeleton(height: 110, borderRadius: radius),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppSkeleton(height: 110, borderRadius: radius),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppSkeleton(height: 110, borderRadius: radius),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const AppSkeleton(width: 180, height: 20),
          const SizedBox(height: 12),
          AppSkeleton(
            width: double.infinity,
            height: 180,
            borderRadius: radius,
          ),
        ],
      ),
    );
  }
}
