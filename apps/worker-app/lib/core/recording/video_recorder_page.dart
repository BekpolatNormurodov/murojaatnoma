import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:video_player/video_player.dart';
import 'package:worker_app/core/recording/recorded_media.dart';
import 'package:worker_app/core/recording/recording_format.dart';
import 'package:worker_app/core/recording/recording_paths.dart';
import 'package:worker_app/core/recording/video_tap_player.dart';

/// To'liq-ekran video yozib olish sahifasini ochadi — REAL qurilma
/// kamerasi bilan (`camera` paketi orqali): old/orqa kamera almashtirish,
/// tap-to-start/tap-to-stop, jonli hisoblagich. To'xtatilgach haqiqiy
/// ko'rib chiqish (`video_player`) va "Ishlatish"/"Qayta olish" tanlovi
/// beriladi.
///
/// Foydalanuvchi bekor qilsa yoki tuzatib bo'lmas xatolik ro'yz bersa
/// `null` qaytaradi. Backend MOCK yoki REAL bo'lishidan qat'i nazar
/// yozib olishning o'zi doim haqiqiy qurilma darajasida.
Future<RecordedMedia?> showVideoRecorderScreen(BuildContext context) {
  return Navigator.of(context).push<RecordedMedia>(
    MaterialPageRoute(builder: (_) => const _VideoRecorderPage()),
  );
}

enum _Phase { initializing, permissionDenied, cameraError, live, recorded }

class _VideoRecorderPage extends StatefulWidget {
  const _VideoRecorderPage();

  @override
  State<_VideoRecorderPage> createState() => _VideoRecorderPageState();
}

class _VideoRecorderPageState extends State<_VideoRecorderPage>
    with WidgetsBindingObserver {
  CameraController? _controller;
  List<CameraDescription> _cameras = const [];
  int _cameraIndex = 0;
  bool _switching = false;
  bool _wasLiveBeforeBackground = false;

  _Phase _phase = _Phase.initializing;
  bool _recording = false;
  bool _permanentlyDenied = false;

  DateTime? _startedAt;
  Duration _elapsed = Duration.zero;
  Timer? _ticker;

  String? _recordedPath;
  int? _recordedSizeBytes;
  VideoPlayerController? _previewController;

  /// `true` — [_attach] chaqirilib, [_recordedPath] chaqiruvchiga
  /// natija sifatida qaytarilgan. Shu holatda `dispose()` faylni
  /// O'CHIRMASLIGI SHART (chaqiruvchi endi shu yo'lga egalik qiladi) —
  /// aks holda yangi biriktirilgan video zudlik bilan o'chib ketardi.
  bool _attached = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_initCamera());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    unawaited(_controller?.dispose());
    unawaited(_previewController?.dispose());
    // Sahifa "Ishlatish" orqali EMAS (masalan orqaga tugmasi bilan)
    // yopilsa — hali biriktirilmagan ko'rib-chiqilayotgan yozuvni
    // tozalaymiz. Muvaffaqiyatli biriktirilgan bo'lsa ([_attached]) fayl
    // endi chaqiruvchiga tegishli — tegilmaydi.
    final path = _recordedPath;
    if (!_attached && path != null) {
      unawaited(_deleteQuietly(path));
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      if (_phase != _Phase.live) return;
      _wasLiveBeforeBackground = true;
      final controller = _controller;
      if (controller != null) {
        if (controller.value.isRecordingVideo) {
          _ticker?.cancel();
          unawaited(controller.stopVideoRecording());
        }
        unawaited(controller.dispose());
      }
      _controller = null;
      if (mounted) {
        setState(() {
          _recording = false;
          _phase = _Phase.initializing;
        });
      }
    } else if (state == AppLifecycleState.resumed) {
      if (_wasLiveBeforeBackground) {
        _wasLiveBeforeBackground = false;
        unawaited(_initCamera());
      }
    }
  }

  Future<void> _initCamera() async {
    setState(() => _phase = _Phase.initializing);

    final Map<Permission, PermissionStatus> statuses;
    try {
      statuses = await [Permission.camera, Permission.microphone].request();
    } on Object {
      if (mounted) setState(() => _phase = _Phase.cameraError);
      return;
    }
    if (!mounted) return;

    final cameraGranted = statuses[Permission.camera]?.isGranted ?? false;
    if (!cameraGranted) {
      final camera = statuses[Permission.camera];
      setState(() {
        _phase = _Phase.permissionDenied;
        _permanentlyDenied = camera?.isPermanentlyDenied ?? false;
      });
      return;
    }
    // Mikrofon rad etilsa ham video yozib bo'lish davom etadi — faqat
    // ovozsiz (kamera pluginining o'zi buni ichkarida boshqaradi).

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _phase = _Phase.cameraError);
        return;
      }
      _cameras = cameras;
      var index = cameras.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
      );
      if (index < 0) index = 0;
      _cameraIndex = index;
      await _openController(cameras[index]);
    } on Object {
      if (mounted) setState(() => _phase = _Phase.cameraError);
    }
  }

  Future<void> _openController(CameraDescription description) async {
    final controller = CameraController(description, ResolutionPreset.high);
    await controller.initialize();
    if (!mounted) {
      unawaited(controller.dispose());
      return;
    }
    final old = _controller;
    _controller = controller;
    setState(() => _phase = _Phase.live);
    unawaited(old?.dispose());
  }

  Future<void> _switchCamera() async {
    if (_cameras.length < 2 || _switching || _recording) return;
    setState(() => _switching = true);
    final nextIndex = (_cameraIndex + 1) % _cameras.length;
    try {
      await _openController(_cameras[nextIndex]);
      _cameraIndex = nextIndex;
    } on Object {
      if (mounted) {
        AppAlert.error(context, context.l10n.videoRecorderError);
      }
    } finally {
      if (mounted) setState(() => _switching = false);
    }
  }

  Future<void> _startRecording() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    try {
      await controller.startVideoRecording();
      if (!mounted) return;
      _startedAt = DateTime.now();
      _ticker?.cancel();
      _ticker = Timer.periodic(const Duration(milliseconds: 200), (_) {
        final startedAt = _startedAt;
        if (!mounted || startedAt == null) return;
        setState(() => _elapsed = DateTime.now().difference(startedAt));
      });
      setState(() {
        _recording = true;
        _elapsed = Duration.zero;
      });
    } on Object {
      if (mounted) {
        AppAlert.error(context, context.l10n.videoRecorderError);
      }
    }
  }

  Future<void> _stopRecording() async {
    final controller = _controller;
    if (controller == null) return;
    _ticker?.cancel();
    _ticker = null;

    try {
      final captured = await controller.stopVideoRecording();
      if (!mounted) return;

      if (_elapsed < const Duration(milliseconds: 500)) {
        // Juda qisqa (tasodifiy tegish) — tashlab, jonli ko'rinishga
        // qaytamiz.
        unawaited(_deleteQuietly(captured.path));
        setState(() => _recording = false);
        return;
      }

      final dest = await RecordingPaths.next(prefix: 'video', extension: 'mp4');
      await captured.saveTo(dest);
      unawaited(_deleteQuietly(captured.path));

      var sizeBytes = 0;
      try {
        sizeBytes = await File(dest).length();
      } on Object {
        sizeBytes = 0;
      }

      final previewController = VideoPlayerController.file(File(dest));
      await previewController.initialize();
      await previewController.setLooping(true);
      if (!mounted) {
        unawaited(previewController.dispose());
        return;
      }

      setState(() {
        _recording = false;
        _phase = _Phase.recorded;
        _recordedPath = dest;
        _recordedSizeBytes = sizeBytes;
        _previewController = previewController;
      });
    } on Object {
      if (mounted) {
        setState(() => _recording = false);
        AppAlert.error(context, context.l10n.videoRecorderError);
      }
    }
  }

  Future<void> _retake() async {
    final path = _recordedPath;
    final preview = _previewController;
    _previewController = null;
    await preview?.dispose();
    if (path != null) unawaited(_deleteQuietly(path));
    setState(() {
      _phase = _Phase.live;
      _recordedPath = null;
      _recordedSizeBytes = null;
      _elapsed = Duration.zero;
    });
  }

  void _attach() {
    final path = _recordedPath;
    if (path == null) return;
    final now = DateTime.now();
    final hh = now.hour.toString().padLeft(2, '0');
    final mm = now.minute.toString().padLeft(2, '0');
    // Fayl endi chaqiruvchiga o'tadi — `dispose()` uni ENDI o'chirmasligi
    // kerak (qarang: [_attached] hujjati).
    _attached = true;
    Navigator.of(context).pop(
      RecordedMedia(
        path: path,
        name: 'Video $hh:$mm.mp4',
        durationMs: _elapsed.inMilliseconds,
        sizeBytes: _recordedSizeBytes,
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

    return Scaffold(
      backgroundColor: AppColors.ink,
      body: switch (_phase) {
        _Phase.initializing => _LoadingView(text: l10n.videoRecorderTitle),
        _Phase.permissionDenied => _PermissionView(
          permanentlyDenied: _permanentlyDenied,
          onGrant: () => unawaited(_initCamera()),
        ),
        _Phase.cameraError => _CameraErrorView(
          onRetry: () => unawaited(_initCamera()),
        ),
        _Phase.live => _LiveView(
          controller: _controller!,
          recording: _recording,
          elapsed: _elapsed,
          canSwitchCamera: _cameras.length > 1 && !_switching,
          onSwitchCamera: () => unawaited(_switchCamera()),
          onToggleRecord: _recording
              ? () => unawaited(_stopRecording())
              : () => unawaited(_startRecording()),
          onClose: () => Navigator.of(context).pop(),
        ),
        _Phase.recorded => _PreviewView(
          controller: _previewController!,
          durationMs: _elapsed.inMilliseconds,
          onRetake: () => unawaited(_retake()),
          onAttach: _attach,
        ),
      },
    );
  }
}

class _LiveView extends StatelessWidget {
  const _LiveView({
    required this.controller,
    required this.recording,
    required this.elapsed,
    required this.canSwitchCamera,
    required this.onSwitchCamera,
    required this.onToggleRecord,
    required this.onClose,
  });

  final CameraController controller;
  final bool recording;
  final Duration elapsed;
  final bool canSwitchCamera;
  final VoidCallback onSwitchCamera;
  final VoidCallback onToggleRecord;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        CameraCoverBox(
          aspectRatio: 1 / controller.value.aspectRatio,
          child: _MirroredPreview(controller: controller),
        ),
        SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Row(
                  children: [
                    _CircleIconButton(
                      icon: IconsaxPlusLinear.close_circle,
                      onTap: recording ? null : onClose,
                    ),
                    const Spacer(),
                    if (recording) _RecBadge(elapsed: elapsed),
                    const Spacer(),
                    const SizedBox(width: 44),
                  ],
                ),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.only(bottom: 28),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    if (canSwitchCamera)
                      _CircleIconButton(
                        icon: IconsaxPlusLinear.refresh_circle,
                        onTap: onSwitchCamera,
                      )
                    else
                      const SizedBox(width: 44),
                    _ShutterButton(recording: recording, onTap: onToggleRecord),
                    const SizedBox(width: 44),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Kamera preview'ini ko'rsatadi — QO'SHIMCHA oynalash (mirror) yo'q.
/// Platforma kamera qatlami (CameraX / AVFoundation) old kamerani allaqachon
/// tabiiy "oyna" ko'rinishida beradi; ilgari bu yerdagi `Transform(scaleX:-1)`
/// uni ikkinchi marta aylantirib chap-o'ng teskari qilib qo'yardi. FAQAT
/// render — `camera` paketi yozib olayotgan xom video baytlariga ta'sir
/// qilmaydi (`face` modulidagi `MirroredCameraPreview` bilan bir xil naqsh —
/// ataylab mustaqil nusxa, `core/` `features/`ga bog'lanmasligi uchun).
class _MirroredPreview extends StatelessWidget {
  const _MirroredPreview({required this.controller});

  final CameraController controller;

  @override
  Widget build(BuildContext context) => CameraPreview(controller);
}

class _ShutterButton extends StatelessWidget {
  const _ShutterButton({required this.recording, required this.onTap});

  final bool recording;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 78,
        height: 78,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.surface, width: 4),
        ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          width: recording ? 30 : 60,
          height: recording ? 30 : 60,
          decoration: BoxDecoration(
            color: AppColors.danger,
            borderRadius: BorderRadius.circular(recording ? 8 : 30),
          ),
        ),
      ),
    );
  }
}

class _RecBadge extends StatelessWidget {
  const _RecBadge({required this.elapsed});

  final Duration elapsed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.danger,
                  shape: BoxShape.circle,
                ),
              )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .fadeIn(duration: 500.ms)
              .then()
              .fadeOut(duration: 500.ms),
          const SizedBox(width: 8),
          Text(
            formatRecordingDuration(elapsed),
            style: AppTextStyles.label.copyWith(
              color: AppColors.surface,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.28),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: 22,
          color: AppColors.surface.withValues(alpha: onTap == null ? 0.4 : 1),
        ),
      ),
    );
  }
}

class _PreviewView extends StatelessWidget {
  const _PreviewView({
    required this.controller,
    required this.durationMs,
    required this.onRetake,
    required this.onAttach,
  });

  final VideoPlayerController controller;
  final int durationMs;
  final VoidCallback onRetake;
  final VoidCallback onAttach;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Stack(
      fit: StackFit.expand,
      children: [
        Center(
          child: AspectRatio(
            aspectRatio: controller.value.aspectRatio,
            child: VideoTapPlayer(controller: controller),
          ),
        ),
        SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: Row(
                  children: [
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.35),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        formatRecordingDuration(
                          Duration(milliseconds: durationMs),
                        ),
                        style: AppTextStyles.label.copyWith(
                          color: AppColors.surface,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                child: Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        label: l10n.videoRecorderRetake,
                        variant: AppButtonVariant.secondary,
                        icon: IconsaxPlusLinear.refresh,
                        onPressed: onRetake,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AppButton(
                        label: l10n.videoRecorderAttach,
                        icon: AppIcons.send,
                        onPressed: onAttach,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation(AppColors.surface),
          ),
          const SizedBox(height: 20),
          Text(
            text,
            style: AppTextStyles.body.copyWith(
              color: AppColors.surface.withValues(alpha: 0.7),
            ),
          ),
        ],
      ),
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

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                AppIcons.lock,
                color: AppColors.danger,
                size: 30,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.videoRecorderPermissionTitle,
              style: AppTextStyles.h3.copyWith(color: AppColors.surface),
            ),
            const SizedBox(height: 6),
            Text(
              l10n.videoRecorderPermissionMessage,
              style: AppTextStyles.body.copyWith(
                color: AppColors.surface.withValues(alpha: 0.7),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            AppButton(
              label: permanentlyDenied
                  ? l10n.recorderOpenSettings
                  : l10n.recorderGrantPermission,
              expand: false,
              onPressed: permanentlyDenied
                  ? () => unawaited(openAppSettings())
                  : onGrant,
            ),
          ],
        ),
      ),
    );
  }
}

class _CameraErrorView extends StatelessWidget {
  const _CameraErrorView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                AppIcons.camera,
                color: AppColors.danger,
                size: 30,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.videoRecorderError,
              style: AppTextStyles.body.copyWith(
                color: AppColors.surface.withValues(alpha: 0.7),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            AppButton(label: l10n.retry, expand: false, onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}
