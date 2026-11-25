import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/core/widgets/empty_view.dart';
import 'package:user_app/core/widgets/error_view.dart';
import 'package:user_app/core/widgets/test_mode_banner.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/presentation/bloc/utilities_cubit.dart';
import 'package:user_app/features/payments/presentation/widgets/utility_type_meta.dart';

/// "To'lovlar" tabi — fuqaroning barcha kommunal xizmat hisoblari ro'yxati.
class UtilitiesPage extends StatelessWidget {
  const UtilitiesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      appBar: AppBar(
        title: Text(l10n.utilitiesPageTitle, style: AppTextStyles.h2),
        actions: [
          IconButton(
            tooltip: l10n.paymentHistoryPageTitle,
            icon: const Icon(AppIcons.receipt),
            onPressed: () => context.push('/payments-history'),
          ),
        ],
      ),
      body: SafeArea(
        // Banner balandligi matnga bog'liq — AppBar ichidagi qat'iy 40 px'da
        // u sarlavha ustiga chiqib qolardi.
        child: WithTestModeBanner(
          child: BlocBuilder<UtilitiesCubit, UtilitiesState>(
            builder: (context, state) => switch (state) {
              UtilitiesLoading() => const ShimmerList(
                6,
                key: Key('utilities_skeleton'),
              ),
              UtilitiesError(:final message) => Padding(
                padding: const EdgeInsets.all(24),
                child: ErrorView(
                  message: message,
                  onRetry: () => context.read<UtilitiesCubit>().load(),
                ),
              ),
              UtilitiesEmpty() => Padding(
                padding: const EdgeInsets.all(24),
                child: EmptyView(
                  icon: AppIcons.wallet,
                  title: l10n.utilitiesEmptyTitle,
                  message: l10n.utilitiesEmptyMessage,
                ),
              ),
              UtilitiesLoaded(:final utilities) => RefreshIndicator(
                onRefresh: () => context.read<UtilitiesCubit>().load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(20),
                  itemCount: utilities.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final utility = utilities[index];
                    return _UtilityRow(utility: utility)
                        .animate(delay: (index * 60).ms)
                        .fadeIn(duration: 250.ms)
                        .slideY(begin: 0.08, end: 0);
                  },
                ),
              ),
            },
          ),
        ),
      ),
    );
  }
}

/// Xizmat kartasi: yuqorida provayder va hisob raqami to'liq kenglikda,
/// pastda qarz summasi va "To'lash" — tor ekran/katta shriftda ham nom va
/// raqam kesilmaydi.
class _UtilityRow extends StatelessWidget {
  const _UtilityRow({required this.utility});

  final Utility utility;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final color = UtilityTypeMeta.color(utility.type);
    final hasDebt = utility.balanceDue > 0;
    return AppCard(
      onTap: () => context.push('/pay', extra: utility),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(
                  UtilityTypeMeta.icon(utility.type),
                  size: 22,
                  color: color,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      utility.provider,
                      style: AppTextStyles.bodyStrong,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${l10n.accountNumberLabel}: ${utility.accountNumber}',
                      style: AppTextStyles.caption.copyWith(color: inkSoft),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: [
                if (hasDebt) ...[
                  Text(
                    formatSom(utility.balanceDue),
                    style: AppTextStyles.h3.copyWith(color: AppColors.danger),
                  ),
                  _PayChip(label: l10n.payButtonLabel),
                ] else
                  AppBadge(
                    variant: AppBadgeVariant.success,
                    label: l10n.noDebtLabel,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PayChip extends StatelessWidget {
  const _PayChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(AppRadii.xs),
      ),
      child: Text(
        label,
        style: AppTextStyles.label.copyWith(color: Colors.white),
      ),
    );
  }
}
