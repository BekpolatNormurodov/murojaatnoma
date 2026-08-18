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
      // Vaqt/holat matn OQIMI ICHIDA, oxirgi so'zga "yopishtirilgan"
      // `WidgetSpan` sifatida — Telegram/WhatsApp uslubi: qisqa xabarda bir
      // qatorda matn bilan yonma-yon, uzun xabarda esa oxirgi qatorga o'zi
      // o'ralib tushadi. ATAYLAB alohida `Column`+`Align` EMAS — `Align`
      // cheksiz (loose) kenglik konstraintida har doim MAKSIMAL kenglikka
      // cho'zilib, pufakchani (hatto bir necha harfli xabarda ham) butun
      // qator bo'ylab yoyib yuborardi.
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: message.text ?? '',
              style: AppTextStyles.body.copyWith(
                color: bubbleContentColor(isMine: isMine, isDark: isDark),
              ),
            ),
            const WidgetSpan(child: SizedBox(width: 8)),
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: MessageMeta(message: message),
            ),
          ],
        ),
      ),
    );
  }
}
