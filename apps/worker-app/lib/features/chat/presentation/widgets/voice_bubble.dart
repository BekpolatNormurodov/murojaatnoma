import 'dart:async';
import 'dart:math' as math;

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/core/recording/voice_playback_controller.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/presentation/widgets/chat_formatters.dart';
import 'package:worker_app/features/chat/presentation/widgets/message_bubble.dart';

/// Ovozli xabar pufakchasi — play/pause tugmasi, to'lqin-shakli (bar)
/// vizuali va davomiylik.
///
/// Ijro REAL (`just_audio` — qarang: [VoicePlaybackController]): tugmaga
/// bosilganda xabar biriktirmasining haqiqiy lokal fayli eshittiriladi.
/// Bar balandliklari — xabar ID'idan olingan barqaror (seed'langan,
/// HAR safar bir xil) dekorativ shakl, chunki haqiqiy amplituda-tahlili
/// (waveform-extraction) YAGNI doirasidan tashqarida; TO'LDIRILGAN
/// qismi esa haqiqiy ijro progressini ko'rsatadi.
class VoiceBubble extends StatefulWidget {
  const VoiceBubble({required this.message, super.key});

  final Message message;

  @override
  State<VoiceBubble> createState() => _VoiceBubbleState();
}

class _VoiceBubbleState extends State<VoiceBubble> {
  late final VoicePlaybackController _playback = VoicePlaybackController(
    widget.message.attachment?.path ?? '',
    onError: () {
      if (mounted) {
        AppAlert.error(context, context.l10n.attachmentPlaybackError);
      }
    },
  )..addListener(_refresh);
  late final List<double> _bars = _generateBars(widget.message.id);

  int get _fallbackDurationMs {
    final ms = widget.message.attachment?.durationMs;
    return (ms == null || ms <= 0) ? 4000 : ms;
  }

  static List<double> _generateBars(String seed) {
    final random = math.Random(seed.hashCode);
    return List.generate(24, (_) => 0.25 + random.nextDouble() * 0.75);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _playback.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isMine = widget.message.isMine;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    // Aksent — mening pufakchamda oq, boshqalarnikida primary. Play tugmasi
    // doirasi shu aksent bilan to'ldiriladi; ustidagi ikon esa doira ustida
    // ko'rinishi uchun "teskari" rangda (mening oq doiramda quyuq yashil,
    // boshqalarning yashil doirasida oq).
    final accent = bubbleAccentColor(isMine: isMine, isDark: isDark);
    final onAccent = isMine ? AppColors.primaryDark : AppColors.surface;
    final durationColor = bubbleMetaColor(isMine: isMine, isDark: isDark);
    final durationMs =
        _playback.duration?.inMilliseconds ?? _fallbackDurationMs;

    return BubbleShell(
      isMine: isMine,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => unawaited(_playback.toggle()),
                child: Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: accent,
                    shape: BoxShape.circle,
                  ),
                  child: _playback.isLoading
                      ? SizedBox(
                          width: 15,
                          height: 15,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation(onAccent),
                          ),
                        )
                      : Icon(
                          _playback.isPlaying
                              ? IconsaxPlusBold.pause
                              : IconsaxPlusBold.play,
                          size: 18,
                          color: onAccent,
                        ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SizedBox(
                  height: 26,
                  child: _Waveform(
                    bars: _bars,
                    progress: _playback.progress,
                    color: accent,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                chatDurationLabel(durationMs),
                style: AppTextStyles.caption.copyWith(color: durationColor),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerRight,
            child: MessageMeta(message: widget.message),
          ),
        ],
      ),
    );
  }
}

class _Waveform extends StatelessWidget {
  const _Waveform({
    required this.bars,
    required this.progress,
    required this.color,
  });

  final List<double> bars;
  final double progress;
  final Color color;

  static const double _maxBarHeight = 22;

  @override
  Widget build(BuildContext context) {
    final playedCount = (bars.length * progress).floor();
    return Row(
      children: [
        for (var i = 0; i < bars.length; i++)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: Container(
                height: bars[i] * _maxBarHeight,
                decoration: BoxDecoration(
                  color: i <= playedCount
                      ? color
                      : color.withValues(alpha: 0.30),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
