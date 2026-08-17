import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/requests_cubit.dart';
import 'package:user_app/features/requests/presentation/widgets/citizen_request_card.dart';
import 'package:user_app/features/requests/presentation/widgets/request_status_chip.dart';

/// "Arizalar" tabi — fuqaroning barcha ariza/shikoyatlari ro'yxati:
/// segmentlangan tur tanlovi (Ariza/Shikoyat) + qidiruv + holat filtri +
/// murojaat kartalari. `RequestsCubit`ning barcha holatlari (yuklanish/
/// bo'sh/xato/yuklandi) shu yerda ko'rsatiladi — hech qachon oq/bo'sh
/// ekran YO'Q.
class RequestsPage extends StatefulWidget {
  const RequestsPage({super.key});

  @override
  State<RequestsPage> createState() => _RequestsPageState();
}

class _RequestsPageState extends State<RequestsPage> {
  Future<void> _openDetail(BuildContext context, String id) async {
    await context.push('/applications/$id');
    if (context.mounted) unawaited(context.read<RequestsCubit>().reload());
  }

  Future<void> _openSubmit(BuildContext context) async {
    await context.push('/applications/submit');
    if (context.mounted) unawaited(context.read<RequestsCubit>().reload());
  }

  Future<void> _openFilterSheet(BuildContext context) async {
    final cubit = context.read<RequestsCubit>();
    final l10n = context.l10n;
    var draftStatus = cubit.statusFilter;

    await showAppFilterSheet(
      context: context,
      title: l10n.requestsFilterTitle,
      sections: [
        StatefulBuilder(
          builder: (sheetContext, setSheetState) => AppSelect<RequestStatus?>(
            label: l10n.requestsFilterStatusLabel,
            hint: l10n.requestsFilterAll,
            searchable: false,
            value: draftStatus,
            options: [
              AppSelectOption(value: null, label: l10n.requestsFilterAll),
              for (final status in RequestStatus.values)
                AppSelectOption(
                  value: status,
                  label: RequestStatusChip.labelOf(context, status),
                ),
            ],
            onChanged: (value) => setSheetState(() => draftStatus = value),
          ),
        ),
      ],
      onApply: () =>
          cubit.load(kind: cubit.kind, status: draftStatus, query: cubit.query),
      onReset: () => cubit.load(kind: cubit.kind, query: cubit.query),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.watch<RequestsCubit>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.citizenRequestsPageTitle,
                      style: AppTextStyles.h1,
                    ),
                  ),
                  _RoundIconButton(
                    icon: AppIcons.add,
                    tooltip: l10n.citizenRequestsAddTooltip,
                    onTap: () => _openSubmit(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: AppSegmented<RequestKind>(
                value: cubit.kind,
                segments: [
                  AppSegment(
                    value: RequestKind.ariza,
                    label: l10n.requestKindAriza,
                  ),
                  AppSegment(
                    value: RequestKind.shikoyat,
                    label: l10n.requestKindShikoyat,
                  ),
                ],
                onChanged: (value) => cubit.load(
                  kind: value,
                  status: cubit.statusFilter,
                  query: cubit.query,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: AppSearchField(
                      hint: l10n.requestsSearchHint,
                      onChanged: (value) => cubit.load(
                        kind: cubit.kind,
                        status: cubit.statusFilter,
                        query: value,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _RoundIconButton(
                    icon: IconsaxPlusLinear.filter,
                    active: cubit.hasActiveFilters,
                    onTap: () => _openFilterSheet(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: switch (cubit.state) {
                RequestsLoading() => const AppSkeletonList(
                  key: Key('requests_skeleton'),
                ),
                RequestsError(:final message) => _RequestsErrorView(
                  message: message,
                  onRetry: cubit.reload,
                ),
                RequestsEmpty() => _RequestsEmptyView(
                  hasFilters:
                      cubit.hasActiveFilters ||
                      (cubit.query?.isNotEmpty ?? false),
                ),
                RequestsLoaded(:final items) => RefreshIndicator(
                  onRefresh: cubit.reload,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                    itemCount: items.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final request = items[index];
                      return CitizenRequestCard(
                            request: request,
                            onTap: () => _openDetail(context, request.id),
                          )
                          .animate(delay: (index * 60).ms)
                          .fadeIn(duration: 250.ms)
                          .slideY(begin: 0.08, end: 0);
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
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool active;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final button = GestureDetector(
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
    final tip = tooltip;
    return tip == null ? button : Tooltip(message: tip, child: button);
  }
}

class _RequestsEmptyView extends StatelessWidget {
  const _RequestsEmptyView({required this.hasFilters});

  final bool hasFilters;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyState(
      icon: AppIcons.requests,
      title: l10n.requestsEmptyTitle,
      message: hasFilters
          ? l10n.requestsEmptyFilteredMessage
          : l10n.requestsEmptyMessage,
    );
  }
}

class _RequestsErrorView extends StatelessWidget {
  const _RequestsErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.requestsErrorTitle,
        message: message,
        action: AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ),
    );
  }
}
