import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';

/// Bitta biriktirilgan faylni ([RequestAttachment]) ko'rsatuvchi qator —
/// turi bo'yicha ikon, nomi va (bo'lsa) hajmi/davomiyligi bilan.
class RequestAttachmentTile extends StatelessWidget {
  const RequestAttachmentTile({
    required this.attachment,
    super.key,
    this.onTap,
    this.onRemove,
  });

  final RequestAttachment attachment;
  final VoidCallback? onTap;

  /// Berilsa, o'ng tomonda o'chirish tugmasi ko'rsatiladi (masalan
  /// murojaat yaratish formasida hali yuborilmagan biriktirma).
  final VoidCallback? onRemove;

  static IconData _iconFor(RequestAttachmentType type) => switch (type) {
    RequestAttachmentType.image => IconsaxPlusLinear.gallery,
    RequestAttachmentType.video => IconsaxPlusLinear.video,
    RequestAttachmentType.voice => IconsaxPlusLinear.microphone_2,
    RequestAttachmentType.file => IconsaxPlusLinear.document_text,
  };

  static String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  static String _formatDuration(int ms) {
    final totalSeconds = (ms / 1000).round();
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      if (attachment.sizeBytes != null) _formatSize(attachment.sizeBytes!),
      if (attachment.durationMs != null && attachment.durationMs! > 0)
        _formatDuration(attachment.durationMs!),
    ];

    return AppListTile(
      title: attachment.name,
      subtitle: parts.isEmpty ? null : parts.join(' • '),
      leadingIcon: _iconFor(attachment.type),
      filled: true,
      onTap: onTap,
      showChevron: onTap != null,
      trailing: onRemove == null
          ? null
          : GestureDetector(
              onTap: onRemove,
              child: const Icon(
                IconsaxPlusLinear.close_circle,
                size: 20,
                color: AppColors.danger,
              ),
            ),
    );
  }
}
