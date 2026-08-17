import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/presentation/bloc/chat_list_cubit.dart';
import 'package:worker_app/features/chat/presentation/widgets/conversation_tile.dart';

/// "Chat" tabi — suhbatlar ro'yxati: tab (barchasi/shaxsiy/guruh) + qidiruv
/// + suhbat qatorlari. `ChatListCubit`ning barcha holatlari
/// (yuklanish/bo'sh/xato/yuklandi) shu yerda ko'rsatiladi — hech qachon
/// oq/bo'sh ekran YO'Q (`RequestsPage` bilan bir xil naqsh).
class ChatPage extends StatelessWidget {
  const ChatPage({super.key});

  Future<void> _openConversation(
    BuildContext context,
    Conversation conversation,
  ) async {
    await context.push('/chat/${conversation.id}', extra: conversation);
    // Suhbatda yangi xabar yuborilgan bo'lishi mumkin — ro'yxatdagi oxirgi
    // xabar/vaqt eskirmasin (`RequestsPage._openDetail` bilan bir xil naqsh).
    if (context.mounted) {
      unawaited(context.read<ChatListCubit>().reload());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final cubit = context.watch<ChatListCubit>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final totalUnread = switch (cubit.state) {
      ChatListLoaded(:final items) => items.fold<int>(
        0,
        (sum, c) => sum + c.unreadCount,
      ),
      _ => 0,
    };

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      l10n.chat,
                      style: AppTextStyles.h1,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (totalUnread > 0) ...[
                    const SizedBox(width: 10),
                    AppBadge(count: totalUnread),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: AppSegmented<ConversationType?>(
                value: cubit.type,
                segments: [
                  AppSegment(value: null, label: l10n.chatTabAll),
                  AppSegment(
                    value: ConversationType.shaxsiy,
                    label: l10n.chatTabPersonal,
                  ),
                  AppSegment(
                    value: ConversationType.guruh,
                    label: l10n.chatTabGroup,
                  ),
                ],
                onChanged: (value) =>
                    cubit.load(type: value, query: cubit.query),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: AppSearchField(
                hint: l10n.chatSearchHint,
                onChanged: (value) =>
                    cubit.load(type: cubit.type, query: value),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: switch (cubit.state) {
                ChatListLoading() => const AppSkeletonList(
                  key: Key('chat_list_skeleton'),
                ),
                ChatListError(:final message) => _ChatErrorView(
                  message: message,
                  onRetry: cubit.reload,
                ),
                ChatListEmpty() => _ChatEmptyView(
                  hasQuery: cubit.query?.isNotEmpty ?? false,
                ),
                ChatListLoaded(:final items) => RefreshIndicator(
                  onRefresh: cubit.reload,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                    itemCount: items.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final conversation = items[index];
                      return ConversationTile(
                        conversation: conversation,
                        onTap: () => _openConversation(context, conversation),
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

class _ChatEmptyView extends StatelessWidget {
  const _ChatEmptyView({required this.hasQuery});

  final bool hasQuery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyState(
      icon: AppIcons.chat,
      title: l10n.chatEmptyTitle,
      message: hasQuery ? l10n.chatEmptyFilteredMessage : l10n.chatEmptyMessage,
    );
  }
}

class _ChatErrorView extends StatelessWidget {
  const _ChatErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.chatErrorTitle,
        message: message,
        action: AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ),
    );
  }
}
