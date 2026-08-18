import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/bloc/conversation_cubit.dart';
import 'package:worker_app/features/chat/presentation/widgets/chat_formatters.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_composer.dart';

/// Bitta suhbat sahifasi — sarlavha panelida avatar+nom+mavjudlik/ishtirokchilar,
/// skrollanadigan xabarlar ro'yxati (sana ajratgichlari va turga xos
/// pufakchalar bilan) va pastda yozish paneli.
///
/// [conversationId] router orqali beriladi (`ConversationCubit.open`ni
/// chaqirish uchun); [conversation] esa (bo'lsa) ro'yxat sahifasidan
/// `extra` sifatida uzatiladi — sarlavha panelida ko'rsatish uchun
/// (alohida "bitta suhbatni olish" usecase'iga ehtiyoj qoldirmaydi, xuddi
/// `OtpPage(phone: state.extra ...)` naqshiga o'xshab).
class ConversationPage extends StatefulWidget {
  const ConversationPage({
    required this.conversationId,
    super.key,
    this.conversation,
  });

  final String conversationId;
  final Conversation? conversation;

  @override
  State<ConversationPage> createState() => _ConversationPageState();
}

class _ConversationPageState extends State<ConversationPage> {
  final _scrollController = ScrollController();
  int _lastMessageCount = -1;
  bool _showScrollToBottom = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  /// Ro'yxat pastdan ~240px dan ko'proq yuqoriga siljiganda "pastga tushish"
  /// tugmasini ko'rsatadi.
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    final show = position.maxScrollExtent - position.pixels > 240;
    if (show != _showScrollToBottom) {
      setState(() => _showScrollToBottom = show);
    }
  }

  void _animateToBottom() {
    if (!_scrollController.hasClients) return;
    unawaited(
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      ),
    );
  }

  /// Yangi xabar kelganda — keyingi kadrda (layout tayyor bo'lgach) pastga
  /// siljiydi.
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) => _animateToBottom());
  }

  Future<void> _send(
    BuildContext context, {
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    final error = await context.read<ConversationCubit>().send(
      type: type,
      text: text,
      attachment: attachment,
      stickerId: stickerId,
    );
    if (!context.mounted) return;
    if (error != null) AppAlert.error(context, error);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final conversation = widget.conversation;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canvas = isDark ? AppColors.darkCanvas : AppColors.canvas;

    return Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
        backgroundColor: canvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: const AppBackButton(),
        titleSpacing: 0,
        title: Row(
          children: [
            AppAvatar(
              name: conversation?.title ?? l10n.chat,
              photoUrl: conversation?.avatarUrl,
              size: 38,
              color: conversation?.type == ConversationType.umumiy
                  ? AppColors.accent
                  : AppColors.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    conversation?.title ?? l10n.chat,
                    style: AppTextStyles.h3,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  // Suhbatdosh yozayotgan bo'lsa (jonli `chat:typing`) —
                  // "yozmoqda…", aks holda odatiy holat (onlayn/ishtirokchilar).
                  // Matn ATAYLAB literal (yangi l10n kaliti umumiy, boshqa
                  // sessiyalar tomonidan tahrirlanayotgan ARB fayllarga
                  // tegmaslik uchun).
                  BlocBuilder<ConversationCubit, ConversationState>(
                    builder: (context, state) {
                      final typing =
                          state is ConversationLoaded && state.peerTyping;
                      if (typing) {
                        return Text(
                          'yozmoqda…',
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        );
                      }
                      if (conversation != null) {
                        return _HeaderSubtitle(conversation: conversation);
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: DecoratedBox(
          // Juda yengil brend "porlashi" (glow) tepada — baland (loud)
          // devor-qog'oz emas (govt ilova), atigi 3–5% primary radial.
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment.topCenter,
              radius: 1.1,
              colors: [
                AppColors.primary.withValues(alpha: isDark ? 0.05 : 0.035),
                Colors.transparent,
              ],
              stops: const [0, 0.55],
            ),
          ),
          child: BlocConsumer<ConversationCubit, ConversationState>(
            listener: (context, state) {
              if (state is ConversationLoaded &&
                  state.messages.length != _lastMessageCount) {
                _lastMessageCount = state.messages.length;
                _scrollToBottom();
              }
            },
            builder: (context, state) => switch (state) {
              ConversationLoading() => const _ConversationSkeleton(
                key: Key('conversation_skeleton'),
              ),
              ConversationError(:final message) => _ConversationErrorView(
                message: message,
              ),
              ConversationLoaded(:final messages) => Column(
                children: [
                  Expanded(
                    child: messages.isEmpty
                        ? EmptyState(
                            icon: AppIcons.chat,
                            title: l10n.conversationEmptyTitle,
                            message: l10n.conversationEmptyMessage,
                          )
                        : Stack(
                            children: [
                              _MessagesList(
                                messages: messages,
                                conversation: conversation,
                                controller: _scrollController,
                              ),
                              Positioned(
                                right: 12,
                                bottom: 12,
                                child: _ScrollToBottomButton(
                                  visible: _showScrollToBottom,
                                  onTap: _animateToBottom,
                                ),
                              ),
                            ],
                          ),
                  ),
                  MessageComposer(
                    onSendText: (text) =>
                        _send(context, type: MessageType.text, text: text),
                    onSendAttachment: (attachment) => _send(
                      context,
                      type: attachment.kind,
                      attachment: attachment,
                    ),
                    onSendSticker: (id) => _send(
                      context,
                      type: MessageType.sticker,
                      stickerId: id,
                    ),
                    onTyping: (isTyping) => context
                        .read<ConversationCubit>()
                        .notifyTyping(isTyping: isTyping),
                  ),
                ],
              ),
            },
          ),
        ),
      ),
    );
  }
}

/// Sarlavha panelidagi kichik matn — shaxsiy suhbatda "onlayn" (mock
/// presence) yashil nuqta bilan, guruh/umumiyda ishtirokchilar soni.
class _HeaderSubtitle extends StatelessWidget {
  const _HeaderSubtitle({required this.conversation});

  final Conversation conversation;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (conversation.type == ConversationType.shaxsiy) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: const BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              l10n.chatPresenceOnline,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      );
    }

    return Text(
      l10n.chatParticipantsCount(conversation.participants),
      style: AppTextStyles.caption.copyWith(
        color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// Xabarlar ro'yxati — kun bo'yicha sana ajratgichlari qo'shadi va bir
/// yuboruvchidan kelgan ketma-ket xabarlarni zichroq joylashtiradi
/// (guruhlash).
class _MessagesList extends StatelessWidget {
  const _MessagesList({
    required this.messages,
    required this.conversation,
    required this.controller,
  });

  final List<Message> messages;
  final Conversation? conversation;
  final ScrollController controller;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[index];
        final previous = index == 0 ? null : messages[index - 1];
        final showDate = !chatSameDay(previous?.createdAt, message.createdAt);
        final newSender =
            previous == null || previous.senderId != message.senderId;
        final showSenderName =
            newSender && conversation?.type != ConversationType.shaxsiy;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showDate) _DateSeparator(iso: message.createdAt),
            MessageBubble(
              message: message,
              showSenderName: showSenderName,
              firstInGroup: newSender,
            ),
          ],
        );
      },
    );
  }
}

/// Markazlashgan sana "pill"i (Bugun / Kecha / sana) — xabarlar orasidagi
/// kun o'zgarishini ajratadi.
class _DateSeparator extends StatelessWidget {
  const _DateSeparator({required this.iso});

  final String iso;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: isDark ? AppColors.darkLine : AppColors.line,
            ),
          ),
          child: Text(
            chatDateSeparatorLabel(context, iso),
            style: AppTextStyles.caption.copyWith(
              color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}

/// Kichik doiraviy "pastga tushish" tugmasi — ro'yxat yuqoriga siljiganda
/// paydo bo'ladi, bosilganda pastga animatsiya bilan tushadi.
class _ScrollToBottomButton extends StatelessWidget {
  const _ScrollToBottomButton({required this.visible, required this.onTap});

  final bool visible;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: const Duration(milliseconds: 180),
        child: AnimatedScale(
          scale: visible ? 1 : 0.8,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutBack,
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isDark ? AppColors.darkLine : AppColors.line,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.ink.withValues(alpha: isDark ? 0.3 : 0.12),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(
                IconsaxPlusLinear.arrow_down_1,
                size: 22,
                color: isDark ? AppColors.darkInkSoft : AppColors.inkSoft,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ConversationSkeleton extends StatelessWidget {
  const _ConversationSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    // Chapga/o'ngga navbatlashgan, quyruqli-radiusli pufakcha shaklidagi
    // placeholderlar.
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      children: const [
        _SkeletonBubble(width: 200, height: 46),
        _SkeletonBubble(width: 150, height: 36),
        _SkeletonBubble(width: 170, height: 44, mine: true),
        _SkeletonBubble(width: 210, height: 60),
        _SkeletonBubble(width: 130, height: 36, mine: true),
        _SkeletonBubble(width: 180, height: 42, mine: true),
      ],
    );
  }
}

class _SkeletonBubble extends StatelessWidget {
  const _SkeletonBubble({
    required this.width,
    required this.height,
    this.mine = false,
  });

  final double width;
  final double height;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    const big = Radius.circular(AppRadii.lg);
    const tail = Radius.circular(6);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: AppSkeleton(
          width: width,
          height: height,
          borderRadius: BorderRadius.only(
            topLeft: big,
            topRight: big,
            bottomLeft: mine ? big : tail,
            bottomRight: mine ? tail : big,
          ),
        ),
      ),
    );
  }
}

class _ConversationErrorView extends StatelessWidget {
  const _ConversationErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: EmptyState(
        icon: AppIcons.close,
        title: l10n.conversationErrorTitle,
        message: message,
        action: AppButton(
          label: l10n.retry,
          expand: false,
          onPressed: () => context.read<ConversationCubit>().retry(),
        ),
      ),
    );
  }
}
