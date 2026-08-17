import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/presentation/bloc/requests_cubit.dart';
import 'package:worker_app/features/requests/presentation/widgets/application_card.dart';
import 'package:worker_app/features/requests/presentation/widgets/status_chip.dart';

/// "Murojaatlar" tabi — xodimga tegishli/biriktirilgan fuqarolar
/// murojaatlari ro'yxati: tab (biriktirilgan/tegishli) + qidiruv + filtr
/// (holat/muhimlik) + murojaat kartalari. `RequestsCubit`ning barcha
/// holatlari (yuklanish/bo'sh/xato/yuklandi) shu yerda ko'rsatiladi —
/// hech qachon oq/bo'sh ekran YO'Q.
class RequestsPage extends StatefulWidget {
  const RequestsPage({super.key});

  @override
  State<RequestsPage> createState() => _RequestsPageState();
}

class _RequestsPageState extends State<RequestsPage> {
  Future<void> _openDetail(BuildContext context, String id) async {
    await context.push('/requests/$id');
    // Detailda javob/ball berilgan bo'lishi mumkin — ro'yxat eskirmasin.
    if (context.mounted) unawaited(context.read<RequestsCubit>().reload());
  }

  Future<void> _openFilterSheet(BuildContext context) async {
    final cubit = context.read<RequestsCubit>();
    final l10n = context.l10n;
    var draftStatus = cubit.statusFilter;
    var draftPriority = cubit.priorityFilter;

    await showAppFilterSheet(
      context: context,
      title: l10n.requestsFilterTitle,
      sections: [
        StatefulBuilder(
          builder: (sheetContext, setSheetState) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppSelect<ApplicationStatus?>(
                label: l10n.requestsFilterStatusLabel,
                hint: l10n.requestsFilterAll,
                searchable: false,
                value: draftStatus,
                options: [
                  AppSelectOption(value: null, label: l10n.requestsFilterAll),
                  for (final status in ApplicationStatus.values)
                    AppSelectOption(
                      value: status,
                      label: StatusChip.labelOf(context, status),
                    ),
                ],
                onChanged: (value) => setSheetState(() => draftStatus = value),
              ),
              const SizedBox(height: 20),
              AppSelect<ApplicationPriority?>(
                label: l10n.requestsFilterPriorityLabel,
                hint: l10n.requestsFilterAll,
                searchable: false,
                value: draftPriority,
                options: [
                  AppSelectOption(value: null, label: l10n.requestsFilterAll),
                  for (final priority in ApplicationPriority.values)
                    AppSelectOption(
                      value: priority,
                      label: ApplicationCard.priorityLabel(context, priority),
                    ),
                ],
                onChanged: (value) =>
                    setSheetState(() => draftPriority = value),
              ),
            ],
          ),
        ),
      ],
      onApply: () => cubit.load(
        assignedOnly: cubit.assignedOnly,
        status: draftStatus,
        priority: draftPriority,
        query: cubit.query,
      ),
      onReset: () =>
          cubit.load(assignedOnly: cubit.assignedOnly, query: cubit.query),
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
                  Expanded(child: Text(l10n.requests, style: AppTextStyles.h1)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: AppSegmented<bool>(
                value: cubit.assignedOnly,
                segments: [
                  AppSegment(value: true, label: l10n.requestsTabAssigned),
                  AppSegment(value: false, label: l10n.requestsTabRelevant),
                ],
                onChanged: (value) => cubit.load(
                  assignedOnly: value,
                  status: cubit.statusFilter,
                  priority: cubit.priorityFilter,
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
                        assignedOnly: cubit.assignedOnly,
                        status: cubit.statusFilter,
                        priority: cubit.priorityFilter,
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
                      final application = items[index];
                      return ApplicationCard(
                        application: application,
                        onTap: () => _openDetail(context, application.id),
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
