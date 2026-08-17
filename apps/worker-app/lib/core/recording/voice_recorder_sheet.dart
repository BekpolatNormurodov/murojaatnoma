import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:worker_app/core/recording/recorded_media.dart';
import 'package:worker_app/core/recording/recording_format.dart';
import 'package:worker_app/core/recording/recording_paths.dart';
import 'package:worker_app/core/recording/voice_playback_controller.dart';

/// Ovozli xabar yozib olish varag'ini ochadi — REAL qurilma mikrofoni
/// bilan (`record` paketi orqali): tap-to-start/tap-to-stop, jonli
/// hisoblagich + daraja (level) animatsiyasi. To'xtatilgach haqiqiy
/// eshitib-ko'rish (`just_audio`) va "Biriktirish"/"Qayta yozish" tanlovi
/// beriladi.
///
/// Foydalanuvchi bekor qilsa yoki tuzatib bo'lmas xatolik ro'yz bersa
/// `null` qaytaradi. Backend MOCK yoki REAL bo'lishidan qat'i nazar
/// yozib olishning o'zi doim haqiqiy qurilma darajasida — mock faqat
/// keyingi tarmoq (`respond`/`sendMessage`) chaqiruviga tegishli.
Future<RecordedMedia?> showVoiceRecorderSheet(BuildContext context) {
  return showAppSheet<RecordedMedia>(
    context: context,
    title: context.l10n.voiceRecorderTitle,
    child: const _VoiceRecorderBody(),
  );
}

enum _Phase { idle, requesting, permissionDenied, recording, recorded, error }

class _VoiceRecorderBody extends StatefulWidget {
  const _VoiceRecorderBody();

  @override
  State<_VoiceRecorderBody> createState() => _VoiceRecorderBodyState();
}

class _VoiceRecorderBodyState extends State<_VoiceRecorderBody> {
  static const _maxBars = 32;

  final _recorder = AudioRecorder();
  StreamSubscription<Amplitude>? _amplitudeSub;
  VoicePlaybackController? _playback;

  _Phase _phase = _Phase.idle;
  bool _permanentlyDenied = false;
  DateTime? _startedAt;
  Duration _elapsed = Duration.zero;
  final List<double> _levelHistory = [];
  String? _path;
  int? _lastSizeBytes;

  @override
  void dispose() {
    unawaited(_amplitudeSub?.cancel());
    // Varaq yozib olish davomida yopilsa (orqaga surish/tashqariga bosish)
    // — hali tugallanmagan sessiyani bekor qilib, yarim-faylni o'chiramiz.
    if (_phase == _Phase.recording) {
      unawaited(_recorder.cancel());
    } else if (_phase == _Phase.recorded && _path != null) {
      unawaited(_deleteQuietly(_path!));
    }
    unawaited(_recorder.dispose());
    _playback?.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() => _phase = _Phase.requesting);

    final PermissionStatus permission;
    try {
      permission = await Permission.microphone.request();
    } on Object {
      if (mounted) setState(() => _phase = _Phase.error);
      return;
    }
    if (!mounted) return;
    if (!permission.isGranted) {
      setState(() {
        _phase = _Phase.permissionDenied;
        _permanentlyDenied = permission.isPermanentlyDenied;
      });
      return;
    }

    try {
      final path = await RecordingPaths.next(prefix: 'voice', extension: 'm4a');
      await _recorder.start(const RecordConfig(), path: path);
      if (!mounted) return;
      _startedAt = DateTime.now();
      _levelHistory.clear();
      unawaited(_amplitudeSub?.cancel());
      _amplitudeSub = _recorder
          .onAmplitudeChanged(const Duration(milliseconds: 150))
          .listen(_onAmplitude);
      setState(() {
        _phase = _Phase.recording;
        _path = path;
        _elapsed = Duration.zero;
      });
    } on Object {
      if (mounted) setState(() => _phase = _Phase.error);
    }
  }

  void _onAmplitude(Amplitude amplitude) {
    if (!mounted || _startedAt == null) return;
    // dBFS taxminan -45 (jim) .. 0 (baland) — 0..1 oralig'ga
    // normallashtiriladi (professional VU-metr emas, faqat jonli
    // "nafas olish" taassurotini berish uchun yetarli).
    final normalized = ((amplitude.current + 45) / 45).clamp(0.0, 1.0);
    setState(() {
      _elapsed = DateTime.now().difference(_startedAt!);
      _levelHistory.add(normalized);
      if (_levelHistory.length > _maxBars) _levelHistory.removeAt(0);
    });
  }

  Future<void> _stop() async {
    await _amplitudeSub?.cancel();
    _amplitudeSub = null;

    try {
      final path = await _recorder.stop();
      if (!mounted) return;
      if (path == null || _elapsed < const Duration(milliseconds: 400)) {
        // Juda qisqa (tasodifiy tegish) — tashlab, boshiga qaytamiz.
        if (path != null) unawaited(_deleteQuietly(path));
        setState(() => _phase = _Phase.idle);
        return;
      }

      var sizeBytes = 0;
      try {
        sizeBytes = await File(path).length();
      } on Object {
        sizeBytes = 0;
      }

      final playback = VoicePlaybackController(
        path,
        onError: () {
          if (mounted) {
            AppAlert.error(context, context.l10n.attachmentPlaybackError);
          }
        },
      )..addListener(_refresh);

      setState(() {
        _phase = _Phase.recorded;
        _path = path;
        _playback = playback;
        _lastSizeBytes = sizeBytes;
      });
    } on Object {
      if (mounted) setState(() => _phase = _Phase.error);
    }
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _discard() async {
    _playback?.dispose();
    _playback = null;
    final path = _path;
    if (path != null) unawaited(_deleteQuietly(path));
    setState(() {
      _phase = _Phase.idle;
      _path = null;
      _elapsed = Duration.zero;
      _levelHistory.clear();
    });
  }

  void _attach() {
    final path = _path;
    if (path == null) return;
    final now = DateTime.now();
    final hh = now.hour.toString().padLeft(2, '0');
    final mm = now.minute.toString().padLeft(2, '0');
    Navigator.of(context).pop(
      RecordedMedia(
        path: path,
        name: 'Ovozli xabar $hh:$mm.m4a',
        durationMs: _elapsed.inMilliseconds,
        sizeBytes: _lastSizeBytes,
      ),
    );
  }

  static Future<void> _deleteQuietly(String path) async {
    try {
      final file = File(path);
      if (file.existsSync()) await file.delete();
    } on Object {
      // Best-effort tozalash — muvaffaqiyatsizlik jim yutiladi.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return switch (_phase) {
      _Phase.permissionDenied => _PermissionView(
        permanentlyDenied: _permanentlyDenied,
        onGrant: () => unawaited(_start()),
      ),
      _Phase.error => _ErrorView(
        onRetry: () => setState(() => _phase = _Phase.idle),
      ),
      _Phase.recorded => _RecordedView(
        durationMs: _elapsed.inMilliseconds,
        playback: _playback!,
        onDiscard: () => unawaited(_discard()),
        onAttach: _attach,
      ),
      _Phase.idle || _Phase.requesting || _Phase.recording => _CaptureView(
        recording: _phase == _Phase.recording,
        enabled: _phase != _Phase.requesting,
        elapsed: _elapsed,
        levelHistory: _levelHistory,
        hint: switch (_phase) {
          _Phase.recording => l10n.voiceRecorderRecordingHint,
          _ => l10n.voiceRecorderIdleHint,
        },
        onTap: _phase == _Phase.recording
            ? () => unawaited(_stop())
            : () => unawaited(_start()),
      ),
    };
  }
}

class _CaptureView extends StatelessWidget {
  const _CaptureView({
    required this.recording,
    required this.enabled,
    required this.elapsed,
    required this.levelHistory,
    required this.hint,
    required this.onTap,
  });

  final bool recording;
  final bool enabled;
  final Duration elapsed;
  final List<double> levelHistory;
  final String hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          formatRecordingDuration(elapsed),
          style: AppTextStyles.h1.copyWith(
            color: recording ? AppColors.danger : inkSoft,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(height: 18),
        _LevelMeter(history: levelHistory, active: recording),
        const SizedBox(height: 26),
        _RecordButton(recording: recording, enabled: enabled, onTap: onTap),
        const SizedBox(height: 16),
        Text(
          hint,
          style: AppTextStyles.caption.copyWith(color: inkSoft),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
      ],
    );
  }
}

class _RecordButton extends StatelessWidget {
  const _RecordButton({
    required this.recording,
    required this.enabled,
    required this.onTap,
  });

  final bool recording;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = recording ? AppColors.danger : AppColors.primary;
    final idleBg = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;

    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: SizedBox(
        width: 96,
        height: 96,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (recording)
              Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: color.withValues(alpha: 0.16),
                    ),
                  )
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scaleXY(
                    begin: 0.82,
                    end: 1.08,
                    duration: 900.ms,
                    curve: Curves.easeInOut,
                  ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 76,
              height: 76,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: enabled ? color : idleBg,
                boxShadow: enabled
                    ? [
                        BoxShadow(
                          color: color.withValues(alpha: 0.35),
                          blurRadius: 26,
                          offset: const Offset(0, 10),
                        ),
                      ]
                    : null,
              ),
              child: !enabled
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        valueColor: AlwaysStoppedAnimation(AppColors.primary),
                      ),
                    )
                  : Icon(
                      recording
                          ? IconsaxPlusBold.stop
                          : IconsaxPlusBold.microphone_2,
                      color: AppColors.surface,
                      size: 30,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LevelMeter extends StatelessWidget {
  const _LevelMeter({required this.history, required this.active});

  final List<double> history;
  final bool active;

  static const _barCount = 32;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final track = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    const activeColor = AppColors.danger;
    final padded = List<double>.generate(_barCount, (i) {
      final idx = i - (_barCount - history.length);
      return idx >= 0 && idx < history.length ? history[idx] : 0.0;
    });

    return SizedBox(
      height: 48,
      child: Row(
        children: [
          for (final value in padded)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1.5),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 120),
                  height: 6 + value.clamp(0, 1) * 36,
                  decoration: BoxDecoration(
                    color: active ? activeColor : track,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _RecordedView extends StatelessWidget {
  const _RecordedView({
    required this.durationMs,
    required this.playback,
    required this.onDiscard,
    required this.onAttach,
  });

  final int durationMs;
  final VoicePlaybackController playback;
  final VoidCallback onDiscard;
  final VoidCallback onAttach;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l10n.voiceRecorderReadyHint,
          style: AppTextStyles.body.copyWith(color: inkSoft),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        AppCard(
          child: _PlaybackRow(playback: playback, durationMs: durationMs),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: l10n.voiceRecorderRetake,
                variant: AppButtonVariant.secondary,
                icon: IconsaxPlusLinear.trash,
                onPressed: onDiscard,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: AppButton(
                label: l10n.voiceRecorderAttach,
                icon: AppIcons.send,
                onPressed: onAttach,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _PlaybackRow extends StatelessWidget {
  const _PlaybackRow({required this.playback, required this.durationMs});

  final VoicePlaybackController playback;
  final int durationMs;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;
    final track = isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;

    return AnimatedBuilder(
      animation: playback,
      builder: (context, _) {
        final total = playback.duration ?? Duration(milliseconds: durationMs);
        return Row(
          children: [
            GestureDetector(
              onTap: () => unawaited(playback.toggle()),
              child: Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: playback.isLoading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(AppColors.surface),
                        ),
                      )
                    : Icon(
                        playback.isPlaying
                            ? IconsaxPlusBold.pause
                            : IconsaxPlusBold.play,
                        color: AppColors.surface,
                        size: 18,
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: playback.progress,
                  minHeight: 6,
                  backgroundColor: track,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              formatRecordingDuration(total),
              style: AppTextStyles.caption.copyWith(color: inkSoft),
            ),
          ],
        );
      },
    );
  }
}

class _PermissionView extends StatelessWidget {
  const _PermissionView({
    required this.permanentlyDenied,
    required this.onGrant,
  });

  final bool permanentlyDenied;
  final VoidCallback onGrant;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.danger.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: const Icon(AppIcons.lock, color: AppColors.danger, size: 30),
        ),
        const SizedBox(height: 16),
        Text(l10n.voiceRecorderPermissionTitle, style: AppTextStyles.h3),
        const SizedBox(height: 6),
        Text(
          l10n.voiceRecorderPermissionMessage,
          style: AppTextStyles.body.copyWith(color: inkSoft),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        AppButton(
          label: permanentlyDenied
              ? l10n.recorderOpenSettings
              : l10n.recorderGrantPermission,
          onPressed: permanentlyDenied
              ? () => unawaited(openAppSettings())
              : onGrant,
        ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inkSoft = isDark ? AppColors.darkInkSoft : AppColors.inkSoft;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 64,
          height: 64,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.danger.withValues(alpha: 0.12),
            shape: BoxShape.circle,
          ),
          child: const Icon(AppIcons.close, color: AppColors.danger, size: 30),
        ),
        const SizedBox(height: 16),
        Text(
          l10n.voiceRecorderError,
          style: AppTextStyles.body.copyWith(color: inkSoft),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
        AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
      ],
    );
  }
}
