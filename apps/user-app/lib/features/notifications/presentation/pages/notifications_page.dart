import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/core/widgets/empty_view.dart';
import 'package:user_app/core/widgets/error_view.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/notifications/presentation/widgets/notification_tile.dart';

/// To'liq ekranli "Bildirishnomalar" sahifasi — bosh sahifadagi qo'ng'iroq
/// belgisidan PUSH qilinadi (`/notifications`, shell darajasidan TASHQARIDA,
/// `/reports`/`/payments-history` bilan bir xil naqsh). `NotificationsCubit`
/// ning BARCHA holatlari (yuklanish/bo'sh/xato/yuklandi) shu yerda
/// ko'rsatiladi — hech qachon oq/bo'sh ekran YO'Q.
class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cubit = context.watch<NotificationsCubit>();
    final hasUnread = cubit.unreadCount > 0;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      appBar: AppBar(
        leading: const AppBackButton(),
        title: Text(l10n.notificationsTitle),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: () =>
                  context.read<NotificationsCubit>().markAllRead(),
              child: Text(
                l10n.notificationsMarkAllRead,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: switch (cubit.state) {
          NotificationsLoading() => const ShimmerList(
            6,
            key: Key('notifications_skeleton'),
          ),
          NotificationsError(:final message) => Padding(
            padding: const EdgeInsets.all(24),
            child: ErrorView(
              message: message,
              onRetry: () => context.read<NotificationsCubit>().load(),
            ),
          ),
          NotificationsEmpty() => EmptyView(
            icon: AppIcons.notification,
            title: l10n.notificationsEmptyTitle,
            message: l10n.notificationsEmptyMessage,
          ),
          NotificationsLoaded(:final items) => RefreshIndicator(
            onRefresh: () =>
                context.read<NotificationsCubit>().load(silent: true),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              children: [
                for (final group in _byDay(items)) ...[
                  _DayHeader(_dayLabel(context, group.$1)),
                  for (final item in group.$2) ...[
                    NotificationTile(
                      key: ValueKey(item.id),
                      item: item,
                      onTap: () => openNotification(context, item),
                    ),
                    const SizedBox(height: 10),
                  ],
                ],
              ],
            ),
          ),
        },
      ),
    );
  }
}

/// Bildirishnomani ochadi: o'qilgan deb belgilaydi va to'liq matnni pastki
/// varaqda ko'rsatadi (ro'yxatda 2 qatordan keyin kesiladi). Murojaatga
/// bog'liq bo'lsa — "Murojaatni ochish".
void openNotification(BuildContext context, NotificationItem item) {
  context.read<NotificationsCubit>().markRead(item.id);
  final (icon, color) = notificationMeta(item.type);
  final isDark = Theme.of(context).brightness == Brightness.dark;
  final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
  final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
  final router = GoRouter.of(context);
  final appId = item.applicationId;

  unawaited(
    showAppSheet<void>(
      context: context,
      title: _t(context, 'Bildirishnoma', 'Уведомление'),
      scrollable: true,
      child: Builder(
        builder: (sheetContext) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                NotificationIconBox(icon: icon, color: color, size: 48),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title, style: AppTextStyles.h3),
                      const SizedBox(height: 4),
                      Text(
                        _fullStamp(item.createdAt),
                        style: AppTextStyles.caption.copyWith(
                          color: inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SelectableText(
              item.body,
              style: AppTextStyles.body.copyWith(color: inkSoft, height: 1.5),
            ),
            if (appId != null && appId.isNotEmpty) ...[
              const SizedBox(height: 20),
              AppButton(
                label: _t(context, 'Murojaatni ochish', 'Открыть обращение'),
                icon: AppIcons.arrowRight,
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  unawaited(router.push('/applications/$appId'));
                },
              ),
            ],
            const SizedBox(height: 8),
          ],
        ),
      ),
    ),
  );
}

List<(DateTime, List<NotificationItem>)> _byDay(List<NotificationItem> items) {
  final groups = <(DateTime, List<NotificationItem>)>[];
  for (final item in items) {
    final d = DateTime(
      item.createdAt.year,
      item.createdAt.month,
      item.createdAt.day,
    );
    if (groups.isEmpty || groups.last.$1 != d) {
      groups.add((d, [item]));
    } else {
      groups.last.$2.add(item);
    }
  }
  return groups;
}

String _dayLabel(BuildContext context, DateTime day) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return _t(context, 'Bugun', 'Сегодня');
  if (diff == 1) return _t(context, 'Kecha', 'Вчера');
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(day.day)}.${two(day.month)}.${day.year}';
}

String _fullStamp(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}.${d.year}, '
      '${two(d.hour)}:${two(d.minute)}';
}

String _t(BuildContext context, String uz, String ru) =>
    Localizations.localeOf(context).languageCode == 'ru' ? ru : uz;

class _DayHeader extends StatelessWidget {
  const _DayHeader(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 14, 4, 8),
      child: Text(
        label,
        style: AppTextStyles.label.copyWith(
          color: isDark ? AppColors.darkInkMuted : AppColors.inkMuted,
        ),
      ),
    );
  }
}
