import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/presentation/widgets/chat_formatters.dart';

/// Suhbatlar ro'yxatidagi bitta qator — avatar (shaxsiy suhbatlarda
/// "onlayn" nuqtasi bilan), sarlavha, oxirgi xabar (bitta qatorda), vaqt
/// va (bo'lsa) o'qilmagan xabarlar soni ([AppBadge]).
///
/// App'ning karta estetikasiga mos (`surface`+`line`, `AppRadii.md`,
/// bosilganda kichrayish + haptik) mustaqil qator — messenjer uslubidagi
/// bir-qatorli ko'rinishni to'liq boshqarish uchun [AppListTile]dan farqli
/// o'ziga xos qilib qurilgan.
class ConversationTile extends StatefulWidget {
  const ConversationTile({required this.conversation, super.key, this.onTap});

  final Conversation conversation;
  final VoidCallback? onTap;

  @override
  State<ConversationTile> createState() => _ConversationTileState();
}

class _ConversationTileState extends State<ConversationTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final conversation = widget.conversation;
    final unread = conversation.unreadCount > 0;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurface : AppColors.surface;
    final line = isDark ? AppColors.darkLine : AppColors.line;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final inkMuted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final isPersonal = conversation.type == ConversationType.shaxsiy;
    final preview = conversation.lastMessagePreview ?? '';

    final avatar = AppAvatar(
      name: conversation.title,
      photoUrl: conversation.avatarUrl,
      size: 52,
      color: conversation.type == ConversationType.umumiy
          ? AppColors.accent
          : AppColors.primary,
    );

    final content = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: line),
      ),
      child: Row(
        children: [
          // Shaxsiy suhbatlarda avatar pastki-o'ng burchagida "onlayn"
          // nuqtasi (mock presence) — surface halqasi bilan.
          if (isPersonal)
            Stack(
              clipBehavior: Clip.none,
              children: [
                avatar,
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: surface, width: 2.5),
                    ),
                  ),
                ),
              ],
            )
          else
            avatar,
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        conversation.title,
                        style: AppTextStyles.bodyStrong.copyWith(color: ink),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      conversationTimeLabel(conversation.lastMessageAt),
                      style: AppTextStyles.caption.copyWith(
                        color: unread ? AppColors.primary : inkMuted,
                        fontWeight: unread ? FontWeight.w700 : FontWeight.w400,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        preview,
                        style: AppTextStyles.caption.copyWith(
                          color: unread ? inkSoft : inkMuted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (unread) ...[
                      const SizedBox(width: 8),
                      AppBadge(count: conversation.unreadCount),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (widget.onTap == null) return content;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap!();
      },
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1,
        duration: const Duration(milliseconds: 120),
        child: content,
      ),
    );
  }
}
