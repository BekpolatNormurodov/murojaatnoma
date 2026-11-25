import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
// Butun ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/core/recording/video_playback_page.dart';
import 'package:worker_app/core/recording/voice_playback_controller.dart';
import 'package:worker_app/core/utils/attachment_launcher.dart';
import 'package:worker_app/core/utils/media_url.dart';
import 'package:worker_app/features/chat/presentation/widgets/network_thumbnail.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';

/// Hisobot biriktirmalari: rasmlar — kvadrat thumbnail to'ri (bosilsa
/// to'liq ekran), qolganlari (ovoz/video/hujjat) — alohida qatorlar.
class ReportAttachmentsView extends StatelessWidget {
  const ReportAttachmentsView({required this.attachments, super.key});

  final List<ReportAttachment> attachments;

  @override
  Widget build(BuildContext context) {
    final images = attachments
        .where((a) => a.kind == ReportAttachmentKind.image)
        .toList();
    final others = attachments
        .where((a) => a.kind != ReportAttachmentKind.image)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (images.isNotEmpty)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final image in images) _ImageThumb(attachment: image),
            ],
          ),
        if (images.isNotEmpty && others.isNotEmpty) const SizedBox(height: 8),
        for (var i = 0; i < others.length; i++) ...[
          if (i > 0) const SizedBox(height: 8),
          switch (others[i].kind) {
            ReportAttachmentKind.voice => ReportVoiceRow(
              url: absoluteMediaUrl(others[i].url),
              durationSec: others[i].durationSec,
            ),
            _ => _FileRow(attachment: others[i]),
          },
        ],
      ],
    );
  }
}

class _ImageThumb extends StatelessWidget {
  const _ImageThumb({required this.attachment});

  final ReportAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final url = absoluteMediaUrl(attachment.url);
    return Semantics(
      button: true,
      label: 'Rasmni ochish',
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => _ImageViewerPage(url: url)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.sm),
          child: SizedBox(
            width: 76,
            height: 76,
            child: NetworkThumbnail(url: url),
          ),
        ),
      ),
    );
  }
}

/// Video va hujjat qatori — nom, hajm/davomiylik; bosilsa ochiladi.
class _FileRow extends StatelessWidget {
  const _FileRow({required this.attachment});

  final ReportAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final isVideo = attachment.kind == ReportAttachmentKind.video;
    final url = absoluteMediaUrl(attachment.url);
    final name = (attachment.fileName ?? '').trim().isNotEmpty
        ? attachment.fileName!.trim()
        : (isVideo ? 'Video' : 'Hujjat');
    final meta = <String>[
      if (attachment.fileSize != null && attachment.fileSize! > 0)
        formatFileSize(attachment.fileSize!),
      if (attachment.durationSec != null && attachment.durationSec! > 0)
        formatDurationSec(attachment.durationSec!),
    ];
    return AppListTile(
      title: name,
      titleMaxLines: 1,
      subtitle: meta.isEmpty ? null : meta.join(' • '),
      leadingIcon: isVideo
          ? IconsaxPlusLinear.video_play
          : IconsaxPlusLinear.document_text,
      filled: true,
      onTap: url.isEmpty
          ? null
          : isVideo
          ? () => showVideoPlaybackPage(context, path: url)
          : () => unawaited(openAttachmentUrl(context, url)),
    );
  }
}

/// Ovozli biriktirma — play/pause, progress chizig'i va davomiylik.
/// Pleer faqat birinchi bosishda ochiladi va sahifa yopilganda yopiladi.
class ReportVoiceRow extends StatefulWidget {
  const ReportVoiceRow({required this.url, this.durationSec, super.key});

  final String url;
  final int? durationSec;

  @override
  State<ReportVoiceRow> createState() => _ReportVoiceRowState();
}

class _ReportVoiceRowState extends State<ReportVoiceRow> {
  late final VoicePlaybackController _playback = VoicePlaybackController(
    widget.url,
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
    _playback
      ..removeListener(_refresh)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    final muted = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final totalSec =
        _playback.duration?.inSeconds ?? (widget.durationSec ?? 0);
    final label = _playback.isPlaying || _playback.progress > 0
        ? '${formatDurationSec(_playback.position.inSeconds)} / '
              '${formatDurationSec(totalSec)}'
        : formatDurationSec(totalSec);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(AppRadii.sm),
      ),
      child: Row(
        children: [
          Semantics(
            button: true,
            label: _playback.isPlaying ? "To'xtatish" : 'Eshitish',
            child: GestureDetector(
              onTap: () => unawaited(_playback.toggle()),
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: _playback.isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(
                            AppColors.surface,
                          ),
                        ),
                      )
                    : Icon(
                        _playback.isPlaying
                            ? IconsaxPlusBold.pause
                            : IconsaxPlusBold.play,
                        size: 18,
                        color: AppColors.surface,
                      ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Ovozli xabar',
                  style: AppTextStyles.caption.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _playback.progress,
                    minHeight: 4,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                    valueColor: const AlwaysStoppedAnimation(
                      AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(color: muted),
            maxLines: 1,
          ),
        ],
      ),
    );
  }
}

/// To'liq ekranli rasm ko'ruvchi (pinch-to-zoom).
class _ImageViewerPage extends StatelessWidget {
  const _ImageViewerPage({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                child: AppBackButton(
                  background: Colors.white.withValues(alpha: 0.15),
                  foreground: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
