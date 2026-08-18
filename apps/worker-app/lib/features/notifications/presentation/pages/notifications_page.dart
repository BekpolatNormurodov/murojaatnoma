import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/features/notifications/presentation/widgets/notification_tile.dart';

/// To'liq ekranli "Bildirishnomalar" sahifasi — bosh sahifadagi qo'ng'iroq
/// belgisidan PUSH qilinadi (`/notifications`, shell darajasidan TASHQARIDA,
/// `/points`/`/meetings` bilan bir xil naqsh). `NotificationsCubit`ning
/// BARCHA holatlari (yuklanish/bo'sh/xato/yuklandi) shu yerda
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
          // Compact icon (not a long text label) so the AppBar title never
          // gets squeezed/truncated (e.g. "Уве..." in RU). The action stays
          // accessible via the tooltip.
          if (hasUnread)
            IconButton(
              onPressed: () =>
                  context.read<NotificationsCubit>().markAllRead(),
              tooltip: l10n.notificationsMarkAllRead,
              icon: const Icon(Icons.done_all, color: AppColors.primary),
            ),
        ],
      ),
      body: SafeArea(
        child: switch (cubit.state) {
          NotificationsLoading() => const AppSkeletonList(
            key: Key('notifications_skeleton'),
          ),
          NotificationsError(:final message) => _ErrorView(
            message: message,
            onRetry: () => context.read<NotificationsCubit>().load(),
          ),
          NotificationsEmpty() => EmptyState(
            icon: AppIcons.notification,
            title: l10n.notificationsEmptyTitle,
            message: l10n.notificationsEmptyMessage,
          ),
          NotificationsLoaded(:final items) => RefreshIndicator(
            onRefresh: () => context.read<NotificationsCubit>().load(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              itemCount: items.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = items[index];
                return NotificationTile(
                  item: item,
                  onTap: () {
                    context.read<NotificationsCubit>().markRead(item.id);
                    // Ro'yxatda matn kesilishi mumkin — bosilganda TO'LIQ
                    // bildirishnoma (sarlavha + butun matn + vaqt) ochiladi,
                    // shunda foydalanuvchi hammasini o'qiy oladi.
                    _showNotificationDetail(context, item);
                  },
                );
              },
            ),
          ),
        },
      ),
    );
  }
}

/// Bosilgan bildirishnomani TO'LIQ ko'rsatuvchi pastki oyna — ro'yxatda matn
/// kesilib qolsa ham, bu yerda butun sarlavha + matn + vaqt o'qiladi.
void _showNotificationDetail(BuildContext context, NotificationItem item) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: isDark ? AppColors.darkSurface : AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.title, style: AppTextStyles.h3),
              const SizedBox(height: 6),
              Text(
                relativeTime(sheetContext, item.createdAt),
                style: AppTextStyles.caption.copyWith(
                  color: isDark ? AppColors.darkInkMuted : AppColors.inkMuted,
                ),
              ),
              const SizedBox(height: 16),
              Text(item.body, style: AppTextStyles.body),
            ],
          ),
        ),
      ),
    ),
  );
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.notificationsErrorTitle,
        message: message,
        action: AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ),
    );
  }
}
