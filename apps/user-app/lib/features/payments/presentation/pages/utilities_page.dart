import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/core/widgets/empty_view.dart';
import 'package:user_app/core/widgets/error_view.dart';
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
        title: Text(l10n.utilitiesPageTitle),
        actions: [
          IconButton(
            tooltip: l10n.paymentHistoryPageTitle,
            icon: const Icon(AppIcons.receipt),
            onPressed: () => context.push('/payments-history'),
          ),
        ],
      ),
      body: SafeArea(
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
    );
  }
}

class _UtilityRow extends StatelessWidget {
  const _UtilityRow({required this.utility});

  final Utility utility;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final hasDebt = utility.balanceDue > 0;
    return AppListTile(
      filled: true,
      leadingIcon: UtilityTypeMeta.icon(utility.type),
      iconColor: UtilityTypeMeta.color(utility.type),
      title: utility.provider,
      // Provayder nomi ("Toshkent issiqlik tarmoqlari" kabi) bitta
      // qatorga sig'may qolsa kesilmasin — 2 qatorgacha to'liq ko'rinadi.
      titleMaxLines: 2,
      subtitle: '${l10n.accountNumberLabel}: ${utility.accountNumber}',
      showChevron: false,
      trailing: hasDebt
          ? _DueChip(amount: utility.balanceDue, label: l10n.payButtonLabel)
          : AppBadge(variant: AppBadgeVariant.success, label: l10n.noDebtLabel),
      onTap: () => context.push('/pay', extra: utility),
    );
  }
}

class _DueChip extends StatelessWidget {
  const _DueChip({required this.amount, required this.label});

  final double amount;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          formatSom(amount),
          style: AppTextStyles.bodyStrong.copyWith(color: AppColors.danger),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(AppRadii.xs),
          ),
          child: Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}
