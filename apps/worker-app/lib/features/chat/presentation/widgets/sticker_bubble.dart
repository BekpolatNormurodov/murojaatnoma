import 'package:flutter/material.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/sticker_catalog.dart';

/// Stiker xabari — chrome'siz (fon-pufakchasiz), katta emoji ko'rinishida.
/// Haqiqiy stiker-rasm assetlari hali ulanmagan — `sticker_catalog.dart`dagi
/// markazlashtirilgan `stickerId -> emoji` xaritasidan foydalanadi (yuborish
/// varag'idagi tanlov to'ri bilan bir xil manba).
class StickerBubble extends StatelessWidget {
  const StickerBubble({required this.message, super.key});

  final Message message;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: message.isMine
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          stickerEmoji(message.stickerId),
          style: const TextStyle(fontSize: 72, height: 1),
        ),
        const SizedBox(height: 2),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: MessageMeta(message: message, onCanvas: true),
        ),
      ],
    );
  }
}
