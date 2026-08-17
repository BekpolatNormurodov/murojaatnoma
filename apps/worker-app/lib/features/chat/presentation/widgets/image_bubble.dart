import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/network_thumbnail.dart';

/// Rasm xabari — kichik ko'rinish (thumbnail), bosilsa to'liq ekranda
/// (pinch-to-zoom bilan) ochiladi.
class ImageBubble extends StatelessWidget {
  const ImageBubble({required this.message, super.key});

  final Message message;

  @override
  Widget build(BuildContext context) {
    final url = message.attachment?.path;

    return BubbleShell(
      isMine: message.isMine,
      padding: const EdgeInsets.all(4),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: GestureDetector(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => _FullImagePage(url: url)),
          ),
          child: Stack(
            children: [
              AspectRatio(
                aspectRatio: 4 / 3,
                child: NetworkThumbnail(url: url),
              ),
              // Vaqt/holat rasmning istalgan (yorug' yoki quyuq) qismida
              // o'qilishi uchun pastda yumshoq quyuq gradient scrim —
              // Telegram uslubida.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        AppColors.ink.withValues(alpha: 0.5),
                      ],
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(10, 18, 10, 7),
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: MessageMeta(message: message, light: true),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FullImagePage extends StatelessWidget {
  const _FullImagePage({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Rasm/video ko'ruvchi (lightbox) fon rangi ATAYLAB doim qora —
      // mavzudan qat'i nazar (fotosurat kontentini eng yaxshi ko'rsatish
      // uchun standart naqsh, xuddi kamera-scrim kabi).
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Center(
            child: InteractiveViewer(
              child: NetworkThumbnail(url: url, fit: BoxFit.contain),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Align(
                alignment: Alignment.topLeft,
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.surface.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      IconsaxPlusLinear.close_circle,
                      color: AppColors.surface,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
