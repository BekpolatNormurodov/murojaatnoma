import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:video_player/video_player.dart';
import 'package:worker_app/core/recording/video_tap_player.dart';

/// Allaqachon biriktirilgan (yozib olingan) video faylni to'liq ekranda
/// ko'rsatadigan sodda ko'ruvchi (viewer) — `AttachmentTile`da video
/// biriktirmaga bosilganda ochiladi. Faqat ijro/pauza — media muharriri
/// EMAS (YAGNI: kesish/filtr kerak emas).
void showVideoPlaybackPage(BuildContext context, {required String path}) {
  Navigator.of(context).push<void>(
    MaterialPageRoute(builder: (_) => _VideoPlaybackPage(path: path)),
  );
}

class _VideoPlaybackPage extends StatefulWidget {
  const _VideoPlaybackPage({required this.path});

  final String path;

  @override
  State<_VideoPlaybackPage> createState() => _VideoPlaybackPageState();
}

class _VideoPlaybackPageState extends State<_VideoPlaybackPage> {
  VideoPlayerController? _controller;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    unawaited(_init());
  }

  Future<void> _init() async {
    final controller = VideoPlayerController.file(File(widget.path));
    try {
      await controller.initialize();
      if (!mounted) {
        unawaited(controller.dispose());
        return;
      }
      setState(() => _controller = controller);
    } on Object {
      unawaited(controller.dispose());
      if (mounted) setState(() => _error = true);
    }
  }

  @override
  void dispose() {
    unawaited(_controller?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final controller = _controller;

    return Scaffold(
      backgroundColor: AppColors.ink,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Center(
            child: _error
                ? Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      l10n.attachmentPlaybackError,
                      style: AppTextStyles.body.copyWith(
                        color: AppColors.surface,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  )
                : controller == null
                ? const CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation(AppColors.surface),
                  )
                : AspectRatio(
                    aspectRatio: controller.value.aspectRatio,
                    child: VideoTapPlayer(controller: controller),
                  ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Align(
                alignment: Alignment.topLeft,
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.28),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      IconsaxPlusLinear.close_circle,
                      size: 22,
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
