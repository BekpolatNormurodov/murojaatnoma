import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/presentation/bloc/suggestions_cubit.dart';
import 'package:worker_app/features/suggestions/presentation/widgets/suggestion_card.dart';
import 'package:worker_app/features/suggestions/presentation/widgets/suggestion_status_chip.dart';

/// "Takliflar" sahifasi — xodimlar tomonidan yuborilgan ratsionalizatorlik
/// g'oyalari ro'yxati: qidiruv + holat filtri + ovoz berish + yangi taklif
/// yuborish. `SuggestionsCubit`ning barcha holatlari (yuklanish/bo'sh/
/// xato/yuklandi) shu yerda ko'rsatiladi — hech qachon oq/bo'sh ekran YO'Q.
///
/// Shell tabidan TASHQARIDA, ro'yxatdan (bosh sahifadagi "Tezkor"
/// tugmalari) PUSH qilinadigan to'liq ekranli sahifa — shuning uchun
/// `RequestsPage`/`RequestDetailPage` bilan bir xil naqsh: o'z `AppBar`i +
/// `AppBackButton`, qidiruv/filtr esa `RequestsPage`dan ko'chirilgan.
class SuggestionsPage extends StatelessWidget {
  const SuggestionsPage({super.key});

  Future<void> _openCreate(BuildContext context) async {
    final cubit = context.read<SuggestionsCubit>();
    await context.push('/suggestions/create');
    if (context.mounted) unawaited(cubit.reload());
  }

  Future<void> _vote(BuildContext context, String id) async {
    final cubit = context.read<SuggestionsCubit>();
    final error = await cubit.vote(id);
    if (error != null && context.mounted) AppAlert.error(context, error);
  }

  Future<void> _openFilterSheet(BuildContext context) async {
    final cubit = context.read<SuggestionsCubit>();
    final l10n = context.l10n;
    var draftStatus = cubit.statusFilter;

    await showAppFilterSheet(
      context: context,
      title: l10n.suggestionsFilterTitle,
      sections: [
        StatefulBuilder(
          builder: (sheetContext, setSheetState) => AppSelect<
            SuggestionStatus?
          >(
            label: l10n.suggestionsFilterStatusLabel,
            hint: l10n.suggestionsFilterAll,
            searchable: false,
            value: draftStatus,
            options: [
              AppSelectOption(
                value: null,
                label: l10n.suggestionsFilterAll,
              ),
              for (final status in SuggestionStatus.values)
                AppSelectOption(
                  value: status,
                  label: SuggestionStatusChip.labelOf(context, status),
                ),
            ],
            onChanged: (value) => setSheetState(() => draftStatus = value),
          ),
        ),
      ],
      onApply: () => cubit.load(status: draftStatus, query: cubit.query),
      onReset: () => cubit.load(query: cubit.query),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;
    final cubit = context.watch<SuggestionsCubit>();

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        title: Text(l10n.suggestionsPageTitle, style: AppTextStyles.h3),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: _RoundIconButton(
              icon: AppIcons.add,
              onTap: () => _openCreate(context),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: AppSearchField(
                      hint: l10n.suggestionsSearchHint,
                      onChanged: (value) =>
                          cubit.load(status: cubit.statusFilter, query: value),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _RoundIconButton(
                    icon: IconsaxPlusLinear.filter,
                    active: cubit.statusFilter != null,
                    onTap: () => _openFilterSheet(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: switch (cubit.state) {
                SuggestionsLoading() => const AppSkeletonList(
                  key: Key('suggestions_skeleton'),
                  avatar: false,
                ),
                SuggestionsError(:final message) => _SuggestionsErrorView(
                  message: message,
                  onRetry: cubit.reload,
                ),
                SuggestionsEmpty() => _SuggestionsEmptyView(
                  hasFilters:
                      cubit.statusFilter != null ||
                      (cubit.query?.isNotEmpty ?? false),
                ),
                SuggestionsLoaded(:final items, :final votingIds) =>
                  RefreshIndicator(
                    onRefresh: cubit.reload,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                      itemCount: items.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final suggestion = items[index];
                        return SuggestionCard(
                          suggestion: suggestion,
                          voting: votingIds.contains(suggestion.id),
                          onVote: () => _vote(context, suggestion.id),
                        );
                      },
                    ),
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? AppColors.primary.withValues(alpha: 0.12) : surface,
          borderRadius: BorderRadius.circular(AppRadii.sm),
          border: Border.all(color: active ? AppColors.primary : line),
        ),
        child: Icon(
          icon,
          size: 20,
          color: active ? AppColors.primary : inkSoft,
        ),
      ),
    );
  }
}

class _SuggestionsEmptyView extends StatelessWidget {
  const _SuggestionsEmptyView({required this.hasFilters});

  final bool hasFilters;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyState(
      icon: AppIcons.lampOn,
      title: l10n.suggestionsEmptyTitle,
      message: hasFilters
          ? l10n.suggestionsEmptyFilteredMessage
          : l10n.suggestionsEmptyMessage,
    );
  }
}

class _SuggestionsErrorView extends StatelessWidget {
  const _SuggestionsErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.suggestionsErrorTitle,
        message: message,
        action: AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ),
    );
  }
}
