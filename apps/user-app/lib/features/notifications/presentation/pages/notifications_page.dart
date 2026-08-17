import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/widgets/app_shimmer.dart';
import 'package:user_app/core/widgets/empty_view.dart';
import 'package:user_app/core/widgets/error_view.dart';
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
                  onTap: () =>
                      context.read<NotificationsCubit>().markRead(item.id),
                );
              },
            ),
          ),
        },
      ),
    );
  }
}
