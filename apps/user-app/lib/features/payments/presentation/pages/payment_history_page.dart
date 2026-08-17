import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/presentation/bloc/payment_history_cubit.dart';
import 'package:user_app/features/payments/presentation/widgets/utility_type_meta.dart';

/// To'lovlar tarixi — barcha o'tgan to'lovlar, kommunal xizmat turi
/// bo'yicha filtrlanadigan.
class PaymentHistoryPage extends StatelessWidget {
  const PaymentHistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(l10n.paymentHistoryPageTitle),
      ),
      body: SafeArea(
        child: BlocBuilder<PaymentHistoryCubit, PaymentHistoryState>(
          builder: (context, state) => switch (state) {
            PaymentHistoryLoading() => const AppSkeletonList(
              key: Key('history_skeleton'),
            ),
            PaymentHistoryError(:final message) => Padding(
              padding: const EdgeInsets.all(24),
              child: EmptyState(
                icon: AppIcons.close,
                title: l10n.dataLoadErrorTitle,
                message: message,
                action: AppButton(
                  label: l10n.retry,
                  expand: false,
                  onPressed: () => context.read<PaymentHistoryCubit>().load(),
                ),
              ),
            ),
            PaymentHistoryEmpty() => Padding(
              padding: const EdgeInsets.all(24),
              child: EmptyState(
                icon: AppIcons.receipt,
                title: l10n.paymentHistoryEmptyTitle,
                message: l10n.paymentHistoryEmptyMessage,
              ),
            ),
            PaymentHistoryLoaded(:final typeFilter, :final filtered) => Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
                  child: _TypeFilter(
                    value: typeFilter,
                    onChanged: (type) =>
                        context.read<PaymentHistoryCubit>().filterByType(type),
                  ),
                ),
                Expanded(
                  child: filtered.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(24),
                          child: EmptyState(
                            icon: AppIcons.receipt,
                            title: l10n.paymentHistoryEmptyTitle,
                            message: l10n.paymentHistoryEmptyMessage,
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                          itemCount: filtered.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: 10),
                          itemBuilder: (context, index) =>
                              _PaymentRow(payment: filtered[index])
                                  .animate(delay: (index * 50).ms)
                                  .fadeIn(duration: 220.ms),
                        ),
                ),
              ],
            ),
          },
        ),
      ),
    );
  }
}

class _TypeFilter extends StatelessWidget {
  const _TypeFilter({required this.value, required this.onChanged});

  final UtilityType? value;
  final ValueChanged<UtilityType?> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppSegmented<UtilityType?>(
      value: value,
      onChanged: onChanged,
      segments: [
        AppSegment(value: null, label: l10n.filterTypeAll),
        for (final type in UtilityType.values)
          AppSegment(
            value: type,
            label: UtilityTypeMeta.shortLabel(l10n, type),
          ),
      ],
    );
  }
}

/// Bitta to'lov qatori — `AppListTile`dan ATAYLAB mustaqil (uni ishlatmaydi):
/// xizmat nomi ("Elektr energiyasi", "Issiqlik ta'minoti" kabi ikki so'zli
/// nomlar) o'z QATORIGA to'liq egalik qilishi kerak, holat-belgisi va summa
/// esa PASTKI, alohida qatorga tushadi — shu tufayli nom hech qachon
/// `AppListTile`ning bitta-qatorli sarlavha+badge+trailing tirbandligida
/// kesilib qolmaydi (ilgari "Elektr ...", "Suv ta'm..." kabi chala
/// ko'rsatilardi).
class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.payment});

  final Payment payment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final color = UtilityTypeMeta.color(payment.type);
    final (variant, statusLabel) = switch (payment.status) {
      PaymentStatus.success => (
        AppBadgeVariant.success,
        l10n.paymentStatusSuccess,
      ),
      PaymentStatus.failed => (
        AppBadgeVariant.danger,
        l10n.paymentStatusFailed,
      ),
      _ => (AppBadgeVariant.warning, l10n.paymentStatusPending),
    };
    final paidAt = DateTime.tryParse(payment.paidAt) ?? DateTime.now();
    final cardLast4 = payment.cardLast4;
    final subtitleParts = <String>[
      formatDate(paidAt),
      if (cardLast4 != null) l10n.paidWithCard(cardLast4),
    ];

    return GestureDetector(
      onTap: () => context.push('/payments-history/receipt', extra: payment),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: surface,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: line),
        ),
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
                    UtilityTypeMeta.icon(payment.type),
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
                        UtilityTypeMeta.label(l10n, payment.type),
                        style: AppTextStyles.bodyStrong,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        subtitleParts.join(' • '),
                        style: AppTextStyles.caption.copyWith(color: inkSoft),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                AppBadge(variant: variant, label: statusLabel),
                const Spacer(),
                Text(
                  formatSom(payment.amount),
                  style: AppTextStyles.bodyStrong,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
