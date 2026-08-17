import 'dart:async';
import 'dart:io';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:video_player/video_player.dart';
import 'package:worker_app/core/recording/video_tap_player.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/chat_formatters.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';
import 'package:worker_app/features/chat/presentation/widgets/network_thumbnail.dart';

const double _size = 190;

/// Doiraviy video xabar (Telegram uslubidagi "round video") — chrome'siz
/// (fon-pufakchasiz), doiraviy ko'rinish + ustida play tugmasi + pastda
/// (tiniq-qora gradient ustida) davomiylik va holat belgisi.
///
/// Video HAQIQIY kamera bilan yozib olinadi (`showVideoRecorderScreen`) —
/// lokal fayl yo'li bilan keladi. Bosilganda to'liq ekranda REAL video
/// ijro etiladi (`video_player`). Faqat eski/legacy `mock://` biriktirmalar
/// uchun (haqiqiy fayl yo'q) vizual "ijro" animatsiyasi ko'rsatiladi.
class RoundVideoBubble extends StatefulWidget {
  const RoundVideoBubble({required this.message, super.key});

  final Message message;

  @override
  State<RoundVideoBubble> createState() => _RoundVideoBubbleState();
}

class _RoundVideoBubbleState extends State<RoundVideoBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: _durationMs),
  );

  int get _durationMs {
    final ms = widget.message.attachment?.durationMs;
    return (ms == null || ms <= 0) ? 6000 : ms;
  }

  String? get _path => widget.message.attachment?.path;

  /// Haqiqiy (ijro etsa bo'ladigan) lokal video faylimi — eski `mock://`
  /// biriktirmalardan farqli o'laroq.
  bool get _isPlayable {
    final path = _path;
    return path != null && path.isNotEmpty && !path.startsWith('mock://');
  }

  Future<void> _onTap() async {
    if (_isPlayable) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(builder: (_) => _FullVideoPage(path: _path!)),
      );
      return;
    }
    // Legacy mock — haqiqiy fayl yo'q, faqat vizual animatsiya.
    if (_controller.isAnimating) {
      _controller.stop();
    } else {
      if (_controller.isCompleted) _controller.reset();
      unawaited(_controller.forward());
    }
    setState(() {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _onTap,
      child: SizedBox(
        width: _size,
        height: _size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            ClipOval(
              child: NetworkThumbnail(
                url: _path,
                icon: IconsaxPlusLinear.video_circle,
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.center,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.55),
                  ],
                ),
              ),
            ),
            // Faqat legacy mock uchun aylanma progress (haqiqiy videoda
            // ijro to'liq ekranda bo'ladi).
            AnimatedBuilder(
              animation: _controller,
              builder: (context, _) => _controller.value <= 0
                  ? const SizedBox.shrink()
                  : SizedBox(
                      width: _size,
                      height: _size,
                      child: CircularProgressIndicator(
                        value: _controller.value,
                        strokeWidth: 3,
                        backgroundColor: Colors.transparent,
                        valueColor: const AlwaysStoppedAnimation(
                          AppColors.surface,
                        ),
                      ),
                    ),
            ),
            AnimatedBuilder(
              animation: _controller,
              builder: (context, _) => Icon(
                _controller.isAnimating
                    ? IconsaxPlusBold.pause
                    : IconsaxPlusBold.play,
                color: AppColors.surface,
                size: 40,
              ),
            ),
            Positioned(
              bottom: 14,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    chatDurationLabel(_durationMs),
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.surface,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 6),
                  MessageMeta(message: widget.message, light: true),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// To'liq ekranli video ko'ruvchi (lightbox) — yozib olingan lokal videoni
/// REAL ijro etadi. Fon ATAYLAB doim qora (mavzudan qat'i nazar).
class _FullVideoPage extends StatefulWidget {
  const _FullVideoPage({required this.path});

  final String path;

  @override
  State<_FullVideoPage> createState() => _FullVideoPageState();
}

class _FullVideoPageState extends State<_FullVideoPage> {
  VideoPlayerController? _controller;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    unawaited(_init());
  }

  Future<void> _init() async {
    final controller = VideoPlayerController.file(File(widget.path));
    try {
      await controller.initialize();
      await controller.setLooping(true);
      if (!mounted) {
        unawaited(controller.dispose());
        return;
      }
      setState(() => _controller = controller);
    } on Object {
      unawaited(controller.dispose());
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    unawaited(_controller?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Center(
            child: _failed
                ? Icon(
                    IconsaxPlusLinear.video_slash,
                    color: AppColors.surface.withValues(alpha: 0.6),
                    size: 48,
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
