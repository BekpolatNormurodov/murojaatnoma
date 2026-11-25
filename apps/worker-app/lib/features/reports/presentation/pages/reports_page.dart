import 'dart:async';

import 'package:app_ui/app_ui.dart';
// Butun ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';
import 'package:worker_app/features/reports/presentation/bloc/reports_cubit.dart';
import 'package:worker_app/features/reports/presentation/bloc/zone_time_cubit.dart';
import 'package:worker_app/features/reports/presentation/widgets/report_card.dart';
import 'package:worker_app/features/reports/presentation/widgets/zone_day_card.dart';

/// "Kunlik hisobot" — ikki tab: yuborilgan hisobotlar (so'nggi 30 kun,
/// kunlar bo'yicha guruhlangan) va "Hududda bo'lgan vaqt" (bugun + 7 kun).
///
/// [ReportsCubit] va [ZoneTimeCubit] router'da (`/reports`) ta'minlanadi.
class ReportsPage extends StatelessWidget {
  const ReportsPage({super.key, this.initialTab = 0});

  final int initialTab;

  Future<void> _openCompose(BuildContext context) async {
    final sent = await context.push<bool>('/reports/new');
    if ((sent ?? false) && context.mounted) {
      AppAlert.success(context, 'Hisobot yuborildi');
      unawaited(context.read<ReportsCubit>().load(silent: true));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return DefaultTabController(
      length: 2,
      initialIndex: initialTab.clamp(0, 1),
      child: Scaffold(
        backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
        appBar: AppBar(
          leading: const AppBackButton(),
          title: const Text('Kunlik hisobot'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Hisobotlar'),
              Tab(text: 'Hududda vaqt'),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          key: const Key('reports_compose_fab'),
          onPressed: () => unawaited(_openCompose(context)),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          icon: const Icon(AppIcons.edit),
          label: const Text('Hisobot yozish'),
        ),
        body: const SafeArea(
          top: false,
          child: TabBarView(children: [_ReportsTab(), _ZoneTimeTab()]),
        ),
      ),
    );
  }
}

/* ───────────────────────── Hisobotlar ───────────────────────── */

class _ReportsTab extends StatelessWidget {
  const _ReportsTab();

  Future<void> _confirmDelete(BuildContext context, DailyReport report) async {
    final cubit = context.read<ReportsCubit>();
    final ok = await AppDialog.confirm(
      context: context,
      title: "Hisobotni o'chirasizmi?",
      message: "Bu amalni qaytarib bo'lmaydi.",
      confirmLabel: "O'chirish",
      danger: true,
      icon: AppIcons.trash,
    );
    if (!ok || !context.mounted) return;
    final error = await cubit.delete(report.id);
    if (!context.mounted) return;
    if (error == null) {
      AppAlert.success(context, "Hisobot o'chirildi");
    } else {
      AppAlert.error(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ReportsCubit, ReportsState>(
      builder: (context, state) {
        final cubit = context.read<ReportsCubit>();
        return switch (state) {
          ReportsLoading() => const _ListSkeleton(),
          ReportsError(:final message) => _ScrollableCenter(
            onRefresh: cubit.load,
            child: EmptyState(
              icon: AppIcons.close,
              title: "Yuklab bo'lmadi",
              message: message,
              action: AppButton(
                label: 'Qayta urinish',
                expand: false,
                onPressed: () => unawaited(cubit.load()),
              ),
            ),
          ),
          ReportsEmpty() => _ScrollableCenter(
            onRefresh: () => cubit.load(silent: true),
            child: const EmptyState(
              icon: AppIcons.documentUpload,
              title: "Hali hisobot yo'q",
              message:
                  'Kun yakunida qilgan ishlaringiz haqida yozing — matn, '
                  'ovoz, rasm, video yoki hujjat biriktirishingiz mumkin.',
            ),
          ),
          ReportsLoaded(:final items, :final deletingIds) => _ReportsList(
            items: items,
            deletingIds: deletingIds,
            onRefresh: () => cubit.load(silent: true),
            onDelete: (r) => unawaited(_confirmDelete(context, r)),
          ),
        };
      },
    );
  }
}

class _ReportsList extends StatelessWidget {
  const _ReportsList({
    required this.items,
    required this.deletingIds,
    required this.onRefresh,
    required this.onDelete,
  });

  final List<DailyReport> items;
  final Set<String> deletingIds;
  final Future<void> Function() onRefresh;
  final ValueChanged<DailyReport> onDelete;

  @override
  Widget build(BuildContext context) {
    // Kun bo'yicha guruhlash (eng yangi kun birinchi; kun ichida eng
    // yangi hisobot birinchi).
    final groups = <String, List<DailyReport>>{};
    for (final r in items) {
      groups.putIfAbsent(r.day, () => []).add(r);
    }
    final days = groups.keys.toList()..sort((a, b) => b.compareTo(a));
    final now = DateTime.now();

    final children = <Widget>[];
    for (final day in days) {
      final dayItems = groups[day]!
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      children
        ..add(_DayHeader(day: day, count: dayItems.length))
        ..add(const SizedBox(height: 8));
      for (final r in dayItems) {
        final canDelete = r.canDeleteOn(now);
        children
          ..add(
            ReportCard(
              key: ValueKey('report_${r.id}'),
              report: r,
              deleting: deletingIds.contains(r.id),
              onDelete: canDelete ? () => onDelete(r) : null,
            ),
          )
          ..add(const SizedBox(height: 10));
      }
      children.add(const SizedBox(height: 8));
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        // Pastda FAB matnni yopmasin.
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: children,
      ),
    );
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader({required this.day, required this.count});

  final String day;
  final int count;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final soft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final date = parseYmd(day);
    final title = formatDayTitle(day);
    final subtitle = (title == 'Bugun' || title == 'Kecha') && date != null
        ? formatDayLong(date)
        : null;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Flexible(
          child: Text(
            subtitle == null ? title : '$title · $subtitle',
            style: AppTextStyles.label.copyWith(color: soft),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '$count ta',
          style: AppTextStyles.caption.copyWith(color: muted),
          maxLines: 1,
        ),
      ],
    );
  }
}

/* ───────────────────────── Hudud vaqti ───────────────────────── */

class _ZoneTimeTab extends StatefulWidget {
  const _ZoneTimeTab();

  @override
  State<_ZoneTimeTab> createState() => _ZoneTimeTabState();
}

class _ZoneTimeTabState extends State<_ZoneTimeTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return BlocBuilder<ZoneTimeCubit, ZoneTimeState>(
      builder: (context, state) {
        final cubit = context.read<ZoneTimeCubit>();
        return switch (state) {
          ZoneTimeLoading() => const _ListSkeleton(),
          ZoneTimeError(:final message) => _ScrollableCenter(
            onRefresh: cubit.load,
            child: EmptyState(
              icon: AppIcons.close,
              title: "Yuklab bo'lmadi",
              message: message,
              action: AppButton(
                label: 'Qayta urinish',
                expand: false,
                onPressed: () => unawaited(cubit.load()),
              ),
            ),
          ),
          ZoneTimeLoaded(:final report) => RefreshIndicator(
            onRefresh: () => cubit.load(silent: true),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
              children: [
                _ZoneSummary(days: report.days, gapMinutes: report.gapMinutes),
                const SizedBox(height: 14),
                if (report.days.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: EmptyState(
                      icon: AppIcons.location,
                      title: "Ma'lumot yo'q",
                      message: "So'nggi kunlar bo'yicha joylashuv topilmadi.",
                    ),
                  )
                else
                  for (final day in report.days) ...[
                    ZoneDayCard(day: day),
                    const SizedBox(height: 10),
                  ],
              ],
            ),
          ),
        };
      },
    );
  }
}

class _ZoneSummary extends StatelessWidget {
  const _ZoneSummary({required this.days, required this.gapMinutes});

  final List<ZoneDay> days;
  final int gapMinutes;

  @override
  Widget build(BuildContext context) {
    var inside = 0;
    var outside = 0;
    for (final d in days) {
      inside += d.zoneMinutes;
      outside += d.outsideMinutes;
    }
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppColors.brandGradient,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "So'nggi ${days.length} kun",
            style: AppTextStyles.caption.copyWith(
              color: Colors.white.withValues(alpha: 0.85),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Hududda: ${formatMinutes(inside)}',
            style: AppTextStyles.h3.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 2),
          Text(
            'Tashqarida: ${formatMinutes(outside)}',
            style: AppTextStyles.body.copyWith(
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$gapMinutes daqiqadan uzun GPS uzilishlari hisobga olinmaydi.',
            style: AppTextStyles.caption.copyWith(
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

/* ───────────────────────── Umumiy ───────────────────────── */

/// Bo'sh/xato holati — pull-to-refresh ishlashi uchun skroll ichida.
class _ScrollableCenter extends StatelessWidget {
  const _ScrollableCenter({required this.child, required this.onRefresh});

  final Widget child;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Center(
              child: Padding(padding: const EdgeInsets.all(24), child: child),
            ),
          ),
        ),
      ),
    );
  }
}

class _ListSkeleton extends StatelessWidget {
  const _ListSkeleton();

  @override
  Widget build(BuildContext context) {
    return const AppSkeletonList(
      key: Key('reports_skeleton'),
      itemCount: 5,
      itemHeight: 96,
      avatar: false,
    );
  }
}
