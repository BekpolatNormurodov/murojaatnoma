import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';

/// Oddiy matnli xabar pufakchasi — matn + pastki-o'ng burchakda vaqt/holat.
class TextBubble extends StatelessWidget {
  const TextBubble({required this.message, super.key});

  final Message message;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isMine = message.isMine;
    return BubbleShell(
      isMine: isMine,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            message.text ?? '',
            style: AppTextStyles.body.copyWith(
              color: bubbleContentColor(isMine: isMine, isDark: isDark),
            ),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: MessageMeta(message: message),
          ),
        ],
      ),
    );
  }
}
