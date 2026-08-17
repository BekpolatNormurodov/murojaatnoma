import 'dart:async';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:video_player/video_player.dart';

/// Video kadrini to'liq ko'rsatib, ustiga bosilganda play/pause
/// almashtiradigan minimal pleyer qatlami — pauza holatida markazda
/// yarim-tiniq play ikonkasi suzib turadi (Telegram/Instagram uslubidagi
/// video-ko'rish tajribasi).
///
/// [controller] allaqachon `initialize()` qilingan bo'lishi kerak —
/// hayot-sikli (`initialize`/`dispose`) chaqiruvchiga tegishli (bu
/// widget faqat vizual qatlam, video yozib olish sahifasi ham,
/// biriktirma-ko'ruvchi sahifa ham o'z controller'ini o'zi boshqaradi).
class VideoTapPlayer extends StatefulWidget {
  const VideoTapPlayer({
    required this.controller,
    super.key,
    this.autoplay = true,
  });

  final VideoPlayerController controller;

  /// `true` bo'lsa birinchi qurilishda avtomatik ijro boshlanadi.
  final bool autoplay;

  @override
  State<VideoTapPlayer> createState() => _VideoTapPlayerState();
}

class _VideoTapPlayerState extends State<VideoTapPlayer> {
  @override
  void initState() {
    super.initState();
    if (widget.autoplay) unawaited(widget.controller.play());
  }

  void _toggle() {
    if (widget.controller.value.isPlaying) {
      unawaited(widget.controller.pause());
    } else {
      unawaited(widget.controller.play());
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _toggle,
      child: Stack(
        alignment: Alignment.center,
        children: [
          VideoPlayer(widget.controller),
          AnimatedBuilder(
            animation: widget.controller,
            builder: (context, _) {
              final playing = widget.controller.value.isPlaying;
              return AnimatedOpacity(
                opacity: playing ? 0 : 1,
                duration: const Duration(milliseconds: 150),
                child: IgnorePointer(
                  child: Container(
                    width: 64,
                    height: 64,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.4),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      IconsaxPlusBold.play,
                      color: AppColors.surface,
                      size: 30,
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
