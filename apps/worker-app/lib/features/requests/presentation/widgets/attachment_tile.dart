import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/core/recording/video_playback_page.dart';
import 'package:worker_app/core/recording/voice_playback_controller.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';

/// Bitta biriktirilgan faylni ([AttachmentRef]) ko'rsatuvchi qator —
/// turi bo'yicha ikon, nomi va (bo'lsa) hajmi/davomiyligi bilan.
///
/// [AttachmentType.voice] uchun chapdagi ikon o'rniga REAL ijro
/// (play/pause + progress halqasi) tugmasi ko'rsatiladi (`just_audio`
/// orqali — qarang: [VoicePlaybackController]). [AttachmentType.video]
/// uchun qatorga bosish (agar tashqi [onTap] berilmagan bo'lsa) faylni
/// to'liq ekranda ijro etadigan ko'ruvchini ochadi. Ikkalasi ham
/// biriktirma mock yoki real backend rejimida yuborilishidan qat'i
/// nazar ishlaydi — faqat lokal fayl yo'liga bog'liq.
class AttachmentTile extends StatelessWidget {
  const AttachmentTile({
    required this.attachment,
    super.key,
    this.onTap,
    this.onRemove,
  });

  final AttachmentRef attachment;
  final VoidCallback? onTap;

  /// Berilsa, o'ng tomonda o'chirish tugmasi ko'rsatiladi (masalan
  /// javob formasida hali yuborilmagan biriktirma).
  final VoidCallback? onRemove;

  static IconData _iconFor(AttachmentType type) => switch (type) {
    AttachmentType.image => IconsaxPlusLinear.gallery,
    AttachmentType.video => IconsaxPlusLinear.video,
    AttachmentType.voice => IconsaxPlusLinear.microphone_2,
    AttachmentType.file => IconsaxPlusLinear.document_text,
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

    final isVoice = attachment.type == AttachmentType.voice;
    final isVideo = attachment.type == AttachmentType.video;
    final effectiveOnTap =
        onTap ??
        (isVideo
            ? () => showVideoPlaybackPage(context, path: attachment.path)
            : null);

    return AppListTile(
      title: attachment.name,
      subtitle: parts.isEmpty ? null : parts.join(' • '),
      leadingIcon: isVoice ? null : _iconFor(attachment.type),
      leading: isVoice ? _VoicePlayLeading(path: attachment.path) : null,
      filled: true,
      onTap: effectiveOnTap,
      showChevron: effectiveOnTap != null,
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

/// Ovozli biriktirma uchun `AttachmentTile`ning chap tomonidagi REAL
/// play/pause tugmasi — atrofida ijro progressini ko'rsatuvchi yupqa
/// halqa bilan. `just_audio`ni tanho birinchi bosishda ochadi
/// ([VoicePlaybackController] — lazy).
class _VoicePlayLeading extends StatefulWidget {
  const _VoicePlayLeading({required this.path});

  final String path;

  @override
  State<_VoicePlayLeading> createState() => _VoicePlayLeadingState();
}

class _VoicePlayLeadingState extends State<_VoicePlayLeading> {
  late final VoicePlaybackController _controller = VoicePlaybackController(
    widget.path,
    onError: () {
      if (mounted) {
        AppAlert.error(context, context.l10n.attachmentPlaybackError);
      }
    },
  )..addListener(_refresh);

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => unawaited(_controller.toggle()),
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadii.sm),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (_controller.progress > 0)
              SizedBox(
                width: 34,
                height: 34,
                child: CircularProgressIndicator(
                  value: _controller.progress,
                  strokeWidth: 2,
                  backgroundColor: Colors.transparent,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
              ),
            if (_controller.isLoading)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(AppColors.primary),
                ),
              )
            else
              Icon(
                _controller.isPlaying
                    ? IconsaxPlusBold.pause
                    : IconsaxPlusBold.play,
                size: 18,
                color: AppColors.primary,
              ),
          ],
        ),
      ),
    );
  }
}
