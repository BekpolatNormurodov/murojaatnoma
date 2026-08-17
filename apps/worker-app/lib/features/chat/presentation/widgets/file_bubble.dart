import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';

/// Fayl xabari — hujjat ikoni, nomi va (ma'lum bo'lsa) hajmi.
class FileBubble extends StatelessWidget {
  const FileBubble({required this.message, super.key});

  final Message message;

  static String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final attachment = message.attachment;
    final name = attachment?.name ?? '';
    final size = attachment?.sizeBytes;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isMine = message.isMine;
    final content = bubbleContentColor(isMine: isMine, isDark: isDark);
    final accent = bubbleAccentColor(isMine: isMine, isDark: isDark);
    // Ikon "pod"i — mening pufakchamda tiniq-oq, boshqalarnikida yumshoq
    // primary tint. Ikonning o'zi aksent rangda (oq/primary).
    final podColor = isMine
        ? AppColors.surface.withValues(alpha: 0.22)
        : AppColors.primary.withValues(alpha: 0.14);
    final sizeColor = isMine
        ? AppColors.surface.withValues(alpha: 0.85)
        : (isDark ? AppColors.darkInkSoft : AppColors.inkSoft);

    return BubbleShell(
      isMine: isMine,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: podColor,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(
                  IconsaxPlusLinear.document_text,
                  size: 20,
                  color: accent,
                ),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      name,
                      style: AppTextStyles.bodyStrong.copyWith(color: content),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (size != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        _formatSize(size),
                        style: AppTextStyles.caption.copyWith(color: sizeColor),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: MessageMeta(message: message),
          ),
        ],
      ),
    );
  }
}
