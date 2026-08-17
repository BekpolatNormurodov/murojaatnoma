import 'dart:async';
import 'dart:math' as math;

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/presentation/widgets/meeting_card.dart';

/// To'liq-ekran, Zoom-uslubidagi video-konferensiya SIMULYATSIYASI.
///
/// Xodimning o'z kamerasi HAQIQIY (`camera` paketi orqali); boshqa
/// ishtirokchilar esa [Meeting.participants] ro'yxatidan simulyatsiya
/// qilinadi (avatarlar, bittalab qo'shilish, tasodifiy kamera/mikrofon
/// holati, "gapiryapti" halqasi). Bu web-admin'ning `VideoCall.tsx`
/// komponentining mobil ekvivalenti — xuddi shu ikki bosqich (lobби +
/// qo'ng'iroq).
Future<void> showMeetingCallScreen(BuildContext context, Meeting meeting) {
  return Navigator.of(context).push<void>(
    MaterialPageRoute(builder: (_) => _MeetingCallPage(meeting: meeting)),
  );
}

enum _Stage { lobby, call }

enum _CamPhase { initializing, permissionDenied, cameraError, live }

/// Simulyatsiya qilingan (haqiqiy bo'lmagan) ishtirokchi — faqat
/// [Meeting.participants]dagi ism-familiyadan quriladi.
class _LiveParticipant {
  _LiveParticipant({
    required this.id,
    required this.name,
    required this.camOn,
    required this.muted,
    this.speaking = false,
  });

  final String id;
  final String name;
  final bool camOn;
  final bool muted;
  final bool speaking;

  _LiveParticipant copyWith({bool? speaking}) => _LiveParticipant(
    id: id,
    name: name,
    camOn: camOn,
    muted: muted,
    speaking: speaking ?? this.speaking,
  );
}

const _reactions = ['👍', '👏', '❤️', '😂', '🎉', '🙌'];

class _MeetingCallPage extends StatefulWidget {
  const _MeetingCallPage({required this.meeting});

  final Meeting meeting;

  @override
  State<_MeetingCallPage> createState() => _MeetingCallPageState();
}

class _MeetingCallPageState extends State<_MeetingCallPage>
    with WidgetsBindingObserver {
  final _random = math.Random();

  CameraController? _controller;

  _Stage _stage = _Stage.lobby;
  _CamPhase _camPhase = _CamPhase.initializing;
  bool _permanentlyDenied = false;
  bool _wasLiveBeforeBackground = false;

  /// `true` faqat ilova old planda (`resumed`) bo'lganda. `_openController`
  /// kamerani ishga tushirish davomida (hali `initializing` bosqichida)
  /// ilova fonga o'tib ketsa ham — natija tayyor bo'lganda kamerani
  /// jonlantirmaslik uchun tekshiriladi.
  bool _appResumed = true;

  /// Sahifa umrida kamida bir marta fonga o'tganini belgilaydi — shunda
  /// keyingi `resumed`da (masalan Sozlamalar'dan qaytgach) ruxsat/kamera
  /// holatini qayta tekshirishga arziydi.
  bool _wasBackgrounded = false;

  bool _micOn = true;
  bool _camOn = true;
  bool _sharing = false;
  bool _panelOpen = false;
  bool _pickerOpen = false;

  DateTime? _startedAt;
  Duration _elapsed = Duration.zero;
  Timer? _elapsedTicker;
  Timer? _speakingTicker;
  final List<Timer> _joinTimers = [];

  final List<_LiveParticipant> _joined = [];
  ({String name})? _toast;
  int _toastSeq = 0;
  Timer? _toastTimer;

  final List<({int id, String emoji, double left})> _floatingReactions = [];
  int _reactionSeq = 0;
  final List<Timer> _reactionTimers = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_initCamera());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _elapsedTicker?.cancel();
    _speakingTicker?.cancel();
    _toastTimer?.cancel();
    for (final t in _joinTimers) {
      t.cancel();
    }
    for (final t in _reactionTimers) {
      t.cancel();
    }
    unawaited(_controller?.dispose());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      _appResumed = false;
      _wasBackgrounded = true;
      if (_camPhase != _CamPhase.live) return;
      _wasLiveBeforeBackground = true;
      unawaited(_controller?.dispose());
      _controller = null;
      if (mounted) setState(() => _camPhase = _CamPhase.initializing);
    } else if (state == AppLifecycleState.resumed) {
      _appResumed = true;
      if (!_wasBackgrounded) return;
      _wasBackgrounded = false;
      if (_wasLiveBeforeBackground) {
        _wasLiveBeforeBackground = false;
        unawaited(_initCamera());
      } else if (_camPhase != _CamPhase.live) {
        // Fonga o'tishdan oldin kamera hali jonlanmagan edi — masalan
        // ruxsat rad etilgan (foydalanuvchi Sozlamalar'ga o'tib qaytgan
        // bo'lishi mumkin), xatolik yuz bergan yoki `initialize()` hali
        // davom etayotgan edi. Har uch holatda ham qayta urinib ko'ramiz.
        unawaited(_initCamera());
      }
    }
  }

  Future<void> _initCamera() async {
    setState(() => _camPhase = _CamPhase.initializing);

    final Map<Permission, PermissionStatus> statuses;
    try {
      statuses = await [Permission.camera, Permission.microphone].request();
    } on Object {
      if (mounted) setState(() => _camPhase = _CamPhase.cameraError);
      return;
    }
    if (!mounted) return;

    final cameraGranted = statuses[Permission.camera]?.isGranted ?? false;
    if (!cameraGranted) {
      final camera = statuses[Permission.camera];
      setState(() {
        _camPhase = _CamPhase.permissionDenied;
        _permanentlyDenied = camera?.isPermanentlyDenied ?? false;
      });
      return;
    }

    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _camPhase = _CamPhase.cameraError);
        return;
      }
      var index = cameras.indexWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
      );
      if (index < 0) index = 0;
      await _openController(cameras[index]);
    } on Object {
      if (mounted) setState(() => _camPhase = _CamPhase.cameraError);
    }
  }

  Future<void> _openController(CameraDescription description) async {
    final controller = CameraController(description, ResolutionPreset.high);
    try {
      await controller.initialize();
    } on Object {
      unawaited(controller.dispose());
      if (mounted) setState(() => _camPhase = _CamPhase.cameraError);
      return;
    }
    if (!mounted || !_appResumed) {
      // Sahifa yopilgan yoki ilova fonga o'tib ulgurgan bo'lishi mumkin
      // (masalan `initialize()` davomida) — kamerani jonlantirmasdan
      // darhol yopamiz, aks holda u fonda yozib olishda davom etardi.
      unawaited(controller.dispose());
      return;
    }
    final old = _controller;
    _controller = controller;
    setState(() => _camPhase = _CamPhase.live);
    unawaited(old?.dispose());
  }

  void _toggleMic() {
    HapticFeedback.selectionClick();
    setState(() => _micOn = !_micOn);
  }

  void _toggleCam() {
    HapticFeedback.selectionClick();
    setState(() => _camOn = !_camOn);
  }

  void _joinWithoutCamera() {
    setState(() {
      _camOn = false;
      _stage = _Stage.call;
    });
    _startCallSimulation();
  }

  void _join() {
    setState(() => _stage = _Stage.call);
    _startCallSimulation();
  }

  void _startCallSimulation() {
    _startedAt = DateTime.now();
    _elapsedTicker?.cancel();
    _elapsedTicker = Timer.periodic(const Duration(seconds: 1), (_) {
      final startedAt = _startedAt;
      if (!mounted || startedAt == null) return;
      setState(() => _elapsed = DateTime.now().difference(startedAt));
    });

    final participants = widget.meeting.participants.take(8).toList();
    for (var i = 0; i < participants.length; i++) {
      final delayMs = 900 + i * 1500 + _random.nextInt(600);
      final timer = Timer(Duration(milliseconds: delayMs), () {
        if (!mounted) return;
        final name = participants[i];
        setState(() {
          _joined.add(
            _LiveParticipant(
              id: '$i-$name',
              name: name,
              camOn: _random.nextDouble() > 0.28,
              muted: _random.nextDouble() > 0.55,
            ),
          );
        });
        _showJoinToast(name);
      });
      _joinTimers.add(timer);
    }

    _speakingTicker?.cancel();
    _speakingTicker = Timer.periodic(const Duration(milliseconds: 1900), (_) {
      if (!mounted || _joined.isEmpty) return;
      final idx = _random.nextDouble() > 0.35
          ? _random.nextInt(_joined.length)
          : -1;
      setState(() {
        for (var i = 0; i < _joined.length; i++) {
          _joined[i] = _joined[i].copyWith(speaking: i == idx);
        }
      });
    });
  }

  void _showJoinToast(String name) {
    final id = ++_toastSeq;
    _toastTimer?.cancel();
    setState(() => _toast = (name: name));
    _toastTimer = Timer(const Duration(milliseconds: 2600), () {
      if (!mounted || id != _toastSeq) return;
      setState(() => _toast = null);
    });
  }

  void _sendReaction(String emoji) {
    final id = ++_reactionSeq;
    final left = 12 + _random.nextDouble() * 76;
    setState(() {
      _floatingReactions.add((id: id, emoji: emoji, left: left));
      _pickerOpen = false;
    });
    final timer = Timer(const Duration(milliseconds: 2400), () {
      if (!mounted) return;
      setState(() => _floatingReactions.removeWhere((r) => r.id == id));
    });
    _reactionTimers.add(timer);
  }

  void _endCall() => Navigator.of(context).pop();

  Future<void> _confirmEndCall() async {
    final l10n = context.l10n;
    final confirmed = await AppDialog.confirm(
      context: context,
      icon: IconsaxPlusBold.call_slash,
      title: l10n.callEndConfirmTitle,
      message: l10n.callEndConfirmMessage,
      confirmLabel: l10n.callEnd,
      cancelLabel: l10n.cancel,
      danger: true,
    );
    if (!confirmed || !mounted) return;
    _endCall();
  }

  String _selfName(BuildContext context) {
    final session = context.watch<AuthCubit>().state.session;
    final name = session?.name.trim() ?? '';
    return name.isNotEmpty ? name : context.l10n.callYou;
  }

  @override
  Widget build(BuildContext context) {
    final selfName = _selfName(context);
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: _stage == _Stage.lobby
          ? _LobbyView(
              meeting: widget.meeting,
              camPhase: _camPhase,
              permanentlyDenied: _permanentlyDenied,
              controller: _controller,
              micOn: _micOn,
              camOn: _camOn,
              selfName: selfName,
              onToggleMic: _toggleMic,
              onToggleCam: _toggleCam,
              onRetryCamera: () => unawaited(_initCamera()),
              onJoin: _join,
              onJoinWithoutCamera: _joinWithoutCamera,
              onClose: _endCall,
            )
          : _CallView(
              meeting: widget.meeting,
              camPhase: _camPhase,
              controller: _controller,
              micOn: _micOn,
              camOn: _camOn,
              sharing: _sharing,
              panelOpen: _panelOpen,
              pickerOpen: _pickerOpen,
              elapsed: _elapsed,
              joined: _joined,
              selfName: selfName,
              toastName: _toast?.name,
              floatingReactions: _floatingReactions,
              onToggleMic: _toggleMic,
              onToggleCam: _toggleCam,
              onToggleSharing: () => setState(() => _sharing = !_sharing),
              onTogglePanel: () => setState(() => _panelOpen = !_panelOpen),
              onTogglePicker: () => setState(() => _pickerOpen = !_pickerOpen),
              onSendReaction: _sendReaction,
              onEndCall: () => unawaited(_confirmEndCall()),
            ),
    );
  }
}

/* ============================================================
   LOBBY
   ============================================================ */

class _LobbyView extends StatelessWidget {
  const _LobbyView({
    required this.meeting,
    required this.camPhase,
    required this.permanentlyDenied,
    required this.controller,
    required this.micOn,
    required this.camOn,
    required this.selfName,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onRetryCamera,
    required this.onJoin,
    required this.onJoinWithoutCamera,
    required this.onClose,
  });

  final Meeting meeting;
  final _CamPhase camPhase;
  final bool permanentlyDenied;
  final CameraController? controller;
  final bool micOn;
  final bool camOn;
  final String selfName;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onRetryCamera;
  final VoidCallback onJoin;
  final VoidCallback onJoinWithoutCamera;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final participants = meeting.participants;

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: const Icon(
                    AppIcons.videoBold,
                    size: 18,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    l10n.callBrandLabel,
                    style: AppTextStyles.bodyStrong.copyWith(
                      color: AppColors.surface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                _CircleIconButton(
                  icon: IconsaxPlusLinear.close_circle,
                  onTap: onClose,
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Column(
                children: [
                  AspectRatio(
                    aspectRatio: 4 / 5,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          _SelfPreview(
                            camPhase: camPhase,
                            camOn: camOn,
                            controller: controller,
                            onRetry: onRetryCamera,
                            permanentlyDenied: permanentlyDenied,
                            selfName: selfName,
                          ),
                          Positioned(
                            left: 12,
                            bottom: 12,
                            child: _SelfBadge(micOn: micOn),
                          ),
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 0,
                            child: Container(
                              padding: const EdgeInsets.only(
                                top: 28,
                                bottom: 14,
                              ),
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.transparent,
                                    Color(0x99000000),
                                  ],
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  _LobbyMediaButton(
                                    on: micOn,
                                    enabled: camPhase == _CamPhase.live,
                                    iconOn: IconsaxPlusBold.microphone_2,
                                    iconOff: IconsaxPlusBold.microphone_slash,
                                    onTap: onToggleMic,
                                  ),
                                  const SizedBox(width: 16),
                                  _LobbyMediaButton(
                                    on: camOn,
                                    enabled: camPhase == _CamPhase.live,
                                    iconOn: IconsaxPlusBold.video,
                                    iconOff: IconsaxPlusBold.video_slash,
                                    onTap: onToggleCam,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surface.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(
                          color: AppColors.surface.withValues(alpha: 0.1),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            AppIcons.lock,
                            size: 13,
                            color: AppColors.primaryLight,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            l10n.callSecureConnection,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.surface.withValues(alpha: 0.6),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      meeting.title,
                      style: AppTextStyles.h2.copyWith(
                        color: AppColors.surface,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Row(
                      children: [
                        const Icon(
                          AppIcons.calendar,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            formatMeetingDateTime(meeting.startAt),
                            style: AppTextStyles.body.copyWith(
                              color: AppColors.surface.withValues(alpha: 0.7),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Row(
                      children: [
                        const Icon(
                          AppIcons.people,
                          size: 16,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            participants.isNotEmpty
                                ? l10n.callParticipantsWaiting(
                                    participants.length,
                                  )
                                : l10n.callYouAreFirst,
                            style: AppTextStyles.body.copyWith(
                              color: AppColors.surface.withValues(alpha: 0.7),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (participants.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: SizedBox(
                        height: 36,
                        child: Stack(
                          children: [
                            for (
                              var i = 0;
                              i < math.min(participants.length, 6);
                              i++
                            )
                              Positioned(
                                left: i * 24.0,
                                child: Container(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: AppColors.ink,
                                      width: 2,
                                    ),
                                  ),
                                  child: AppAvatar(
                                    name: participants[i],
                                    size: 34,
                                  ),
                                ),
                              ),
                            if (participants.length > 6)
                              Positioned(
                                left: 6 * 24.0,
                                child: Container(
                                  width: 34,
                                  height: 34,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.surface.withValues(
                                      alpha: 0.1,
                                    ),
                                    border: Border.all(
                                      color: AppColors.ink,
                                      width: 2,
                                    ),
                                  ),
                                  child: Text(
                                    '+${participants.length - 6}',
                                    style: AppTextStyles.caption.copyWith(
                                      color: AppColors.surface,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: _PrimaryPillButton(
                      label: l10n.callLobbyJoinNow,
                      icon: IconsaxPlusBold.video,
                      onTap: onJoin,
                    ),
                  ),
                  if (camPhase == _CamPhase.permissionDenied ||
                      camPhase == _CamPhase.cameraError) ...[
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: _SecondaryPillButton(
                        label: l10n.callJoinWithoutCamera,
                        icon: IconsaxPlusLinear.video_slash,
                        onTap: onJoinWithoutCamera,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Text(
                    l10n.callDeviceOnlyNote,
                    textAlign: TextAlign.center,
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.surface.withValues(alpha: 0.35),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelfPreview extends StatelessWidget {
  const _SelfPreview({
    required this.camPhase,
    required this.camOn,
    required this.controller,
    required this.onRetry,
    required this.permanentlyDenied,
    required this.selfName,
  });

  final _CamPhase camPhase;
  final bool camOn;
  final CameraController? controller;
  final VoidCallback onRetry;
  final bool permanentlyDenied;
  final String selfName;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final ctrl = controller;

    if (camPhase == _CamPhase.live && camOn && ctrl != null) {
      return ColoredBox(
        color: AppColors.darkSurface,
        child: CameraCoverBox(
          aspectRatio: 1 / ctrl.value.aspectRatio,
          child: CameraPreview(ctrl),
        ),
      );
    }

    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.darkSurfaceAlt, AppColors.darkCanvas],
        ),
      ),
      child: Center(
        child: switch (camPhase) {
          _CamPhase.initializing => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(
                strokeWidth: 2.4,
                valueColor: AlwaysStoppedAnimation(AppColors.primary),
              ),
              const SizedBox(height: 14),
              Text(
                l10n.callInitializingMedia,
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.surface.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
          _CamPhase.permissionDenied => _PermissionDeniedCard(
            permanentlyDenied: permanentlyDenied,
            onRetry: onRetry,
          ),
          _CamPhase.cameraError => _CameraErrorCard(onRetry: onRetry),
          _CamPhase.live => Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppAvatar(name: selfName, color: AppColors.primary, size: 84),
                const SizedBox(height: 12),
                Text(
                  l10n.callCameraOff,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.surface.withValues(alpha: 0.5),
                  ),
                ),
              ],
            ),
          ),
        },
      ),
    );
  }
}

class _PermissionDeniedCard extends StatelessWidget {
  const _PermissionDeniedCard({
    required this.permanentlyDenied,
    required this.onRetry,
  });

  final bool permanentlyDenied;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              IconsaxPlusBold.danger,
              color: AppColors.danger,
              size: 28,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            l10n.videoRecorderPermissionTitle,
            style: AppTextStyles.h3.copyWith(color: AppColors.surface),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            l10n.videoRecorderPermissionMessage,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.surface.withValues(alpha: 0.6),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          _SecondaryPillButton(
            label: permanentlyDenied
                ? l10n.recorderOpenSettings
                : l10n.recorderGrantPermission,
            icon: IconsaxPlusLinear.refresh_2,
            onTap: permanentlyDenied
                ? () => unawaited(openAppSettings())
                : onRetry,
          ),
        ],
      ),
    );
  }
}

class _CameraErrorCard extends StatelessWidget {
  const _CameraErrorCard({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              AppIcons.camera,
              color: AppColors.danger,
              size: 28,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            l10n.videoRecorderError,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.surface.withValues(alpha: 0.6),
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          _SecondaryPillButton(
            label: l10n.retry,
            icon: IconsaxPlusLinear.refresh_2,
            onTap: onRetry,
          ),
        ],
      ),
    );
  }
}

class _SelfBadge extends StatelessWidget {
  const _SelfBadge({required this.micOn});

  final bool micOn;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            l10n.callYou,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.surface,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 6),
          Container(
            width: 18,
            height: 18,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: micOn
                  ? AppColors.primary.withValues(alpha: 0.8)
                  : AppColors.danger.withValues(alpha: 0.85),
              shape: BoxShape.circle,
            ),
            child: Icon(
              micOn
                  ? IconsaxPlusBold.microphone_2
                  : IconsaxPlusBold.microphone_slash,
              size: 10,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _LobbyMediaButton extends StatelessWidget {
  const _LobbyMediaButton({
    required this.on,
    required this.enabled,
    required this.iconOn,
    required this.iconOff,
    required this.onTap,
  });

  final bool on;
  final bool enabled;
  final IconData iconOn;
  final IconData iconOff;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        width: 52,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on
              ? AppColors.surface.withValues(alpha: 0.16)
              : AppColors.danger.withValues(alpha: 0.9),
          shape: BoxShape.circle,
        ),
        child: Icon(
          on ? iconOn : iconOff,
          size: 22,
          color: Colors.white.withValues(alpha: enabled ? 1 : 0.4),
        ),
      ),
    );
  }
}

/* ============================================================
   CALL
   ============================================================ */

class _CallView extends StatelessWidget {
  const _CallView({
    required this.meeting,
    required this.camPhase,
    required this.controller,
    required this.micOn,
    required this.camOn,
    required this.sharing,
    required this.panelOpen,
    required this.pickerOpen,
    required this.elapsed,
    required this.joined,
    required this.selfName,
    required this.toastName,
    required this.floatingReactions,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onToggleSharing,
    required this.onTogglePanel,
    required this.onTogglePicker,
    required this.onSendReaction,
    required this.onEndCall,
  });

  final Meeting meeting;
  final _CamPhase camPhase;
  final CameraController? controller;
  final bool micOn;
  final bool camOn;
  final bool sharing;
  final bool panelOpen;
  final bool pickerOpen;
  final Duration elapsed;
  final List<_LiveParticipant> joined;
  final String selfName;
  final String? toastName;
  final List<({int id, String emoji, double left})> floatingReactions;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onToggleSharing;
  final VoidCallback onTogglePanel;
  final VoidCallback onTogglePicker;
  final void Function(String emoji) onSendReaction;
  final VoidCallback onEndCall;

  int get _total => joined.length + 1;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _CallTopBar(
            title: meeting.title,
            elapsed: elapsed,
            total: _total,
            panelOpen: panelOpen,
            onTogglePanel: onTogglePanel,
            onClose: onEndCall,
          ),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Stack(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(10),
                        child: _ParticipantGrid(
                          camPhase: camPhase,
                          controller: controller,
                          micOn: micOn,
                          camOn: camOn,
                          joined: joined,
                          selfName: selfName,
                        ),
                      ),
                      if (sharing)
                        Positioned(
                          top: 8,
                          left: 0,
                          right: 0,
                          child: Center(
                            child: _FloatingPill(
                              text: context.l10n.callSharingBanner,
                              color: AppColors.accent,
                            ),
                          ),
                        )
                      else if (toastName != null)
                        Positioned(
                          top: 8,
                          left: 0,
                          right: 0,
                          child: Center(
                            child: _FloatingPill(
                              key: ValueKey(toastName),
                              text: context.l10n.callParticipantJoined(
                                toastName!,
                              ),
                              color: Colors.black.withValues(alpha: 0.7),
                            ),
                          ),
                        ),
                      ..._buildFloatingReactions(),
                    ],
                  ),
                ),
                _PeoplePanel(
                  open: panelOpen,
                  meeting: meeting,
                  micOn: micOn,
                  camOn: camOn,
                  joined: joined,
                  onClose: onTogglePanel,
                ),
              ],
            ),
          ),
          _CallControls(
            micOn: micOn,
            camOn: camOn,
            sharing: sharing,
            pickerOpen: pickerOpen,
            onToggleMic: onToggleMic,
            onToggleCam: onToggleCam,
            onToggleSharing: onToggleSharing,
            onTogglePicker: onTogglePicker,
            onSendReaction: onSendReaction,
            onEndCall: onEndCall,
          ),
        ],
      ),
    );
  }

  List<Widget> _buildFloatingReactions() {
    return [
      for (final r in floatingReactions)
        Positioned(
          key: ValueKey(r.id),
          bottom: 8,
          left: 0,
          right: 0,
          child: Align(
            alignment: Alignment((r.left / 50) - 1, 1),
            child: Text(r.emoji, style: const TextStyle(fontSize: 30))
                .animate()
                .fadeIn(duration: 200.ms)
                .then()
                .moveY(
                  begin: 0,
                  end: -220,
                  duration: 2200.ms,
                  curve: Curves.easeOut,
                )
                .fadeOut(delay: 1600.ms, duration: 600.ms),
          ),
        ),
    ];
  }
}

class _CallTopBar extends StatelessWidget {
  const _CallTopBar({
    required this.title,
    required this.elapsed,
    required this.total,
    required this.panelOpen,
    required this.onTogglePanel,
    required this.onClose,
  });

  final String title;
  final Duration elapsed;
  final int total;
  final bool panelOpen;
  final VoidCallback onTogglePanel;
  final VoidCallback onClose;

  static String _fmt(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '$h:$m:$s' : '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(99),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                      IconsaxPlusBold.record_circle,
                      size: 11,
                      color: AppColors.danger,
                    )
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .fadeIn(duration: 500.ms)
                    .then()
                    .fadeOut(duration: 500.ms),
                const SizedBox(width: 5),
                Text(
                  l10n.callLive,
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: AppTextStyles.bodyStrong.copyWith(
                    color: AppColors.surface,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  _fmt(elapsed),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.surface.withValues(alpha: 0.5),
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surface.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(99),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(AppIcons.people, size: 13, color: AppColors.surface),
                const SizedBox(width: 5),
                Text(
                  '$total',
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.surface,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _CircleIconButton(
            icon: IconsaxPlusBold.profile_2user,
            active: panelOpen,
            onTap: onTogglePanel,
          ),
          const SizedBox(width: 6),
          _CircleIconButton(
            icon: IconsaxPlusLinear.close_circle,
            onTap: onClose,
          ),
        ],
      ),
    );
  }
}

class _ParticipantGrid extends StatelessWidget {
  const _ParticipantGrid({
    required this.camPhase,
    required this.controller,
    required this.micOn,
    required this.camOn,
    required this.joined,
    required this.selfName,
  });

  final _CamPhase camPhase;
  final CameraController? controller;
  final bool micOn;
  final bool camOn;
  final List<_LiveParticipant> joined;
  final String selfName;

  static const double _spacing = 10;

  int get _total => joined.length + 1;

  /// Barcha bosqichlarda (1 dan 9 gacha) plitkalar ekran balandligiga sig'ib
  /// ketishi uchun ustunlar soni: 1-2 — bitta ustun (portret), 3-4 — 2x2,
  /// 5+ — 3 ustun (jonli ravishda balandlikka moslashadi, ichki skroll
  /// kerak bo'lmaydi).
  int _crossAxisCountFor(int total) {
    if (total <= 1) return 1;
    if (total == 2) return 1;
    if (total <= 4) return 2;
    return 3;
  }

  @override
  Widget build(BuildContext context) {
    if (_total <= 4) {
      // Kam ishtirokchida avvalgi "cozy" portret nisbat saqlanadi.
      return GridView.builder(
        padding: EdgeInsets.zero,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: _crossAxisCountFor(_total),
          mainAxisSpacing: _spacing,
          crossAxisSpacing: _spacing,
          childAspectRatio: _total <= 2 ? 3 / 4 : 1,
        ),
        itemCount: _total,
        itemBuilder: _buildTile,
      );
    }

    // Ko'p ishtirokchida (5-9) mavjud balandlikka qarab nisbatni
    // hisoblaymiz, shunda barcha plitkalar ichki skrollsiz sig'adi.
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = _crossAxisCountFor(_total);
        final rows = (_total / crossAxisCount).ceil();
        final cellWidth =
            (constraints.maxWidth - _spacing * (crossAxisCount - 1)) /
            crossAxisCount;
        final cellHeight =
            (constraints.maxHeight - _spacing * (rows - 1)) / rows;
        final aspectRatio = cellHeight > 0
            ? (cellWidth / cellHeight).clamp(0.5, 1.6)
            : 1.0;
        return GridView.builder(
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            mainAxisSpacing: _spacing,
            crossAxisSpacing: _spacing,
            childAspectRatio: aspectRatio,
          ),
          itemCount: _total,
          itemBuilder: _buildTile,
        );
      },
    );
  }

  Widget _buildTile(BuildContext context, int index) {
    if (index == 0) {
      return _Tile(
        speaking: micOn && camPhase == _CamPhase.live,
        highlight: true,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (camPhase == _CamPhase.live && camOn && controller != null)
              CameraCoverBox(
                aspectRatio: 1 / controller!.value.aspectRatio,
                child: CameraPreview(controller!),
              )
            else
              DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.darkSurfaceAlt, AppColors.darkCanvas],
                  ),
                ),
                child: Center(
                  child: AppAvatar(
                    name: selfName,
                    color: AppColors.primary,
                    size: 64,
                  ),
                ),
              ),
            _TileLabel(name: selfName, muted: !micOn, self: true),
          ],
        ),
      );
    }

    final p = joined[index - 1];
    return _Tile(
          speaking: p.speaking,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (p.camOn)
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.primary.withValues(alpha: 0.18),
                        AppColors.darkCanvas,
                      ],
                    ),
                  ),
                  child: Center(child: AppAvatar(name: p.name, size: 56)),
                )
              else
                DecoratedBox(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.darkSurfaceAlt,
                        AppColors.darkCanvas,
                      ],
                    ),
                  ),
                  child: Center(child: AppAvatar(name: p.name, size: 56)),
                ),
              _TileLabel(name: p.name, muted: p.muted),
            ],
          ),
        )
        .animate()
        .fadeIn(duration: 260.ms)
        .scale(
          begin: const Offset(0.9, 0.9),
          end: const Offset(1, 1),
          duration: 260.ms,
          curve: Curves.easeOutBack,
        );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.child,
    this.speaking = false,
    this.highlight = false,
  });

  final Widget child;
  final bool speaking;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: speaking
              ? AppColors.primary
              : highlight
              ? AppColors.surface.withValues(alpha: 0.12)
              : Colors.transparent,
          width: speaking ? 2.5 : 1.5,
        ),
        boxShadow: speaking
            ? [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
                  blurRadius: 14,
                  spreadRadius: 1,
                ),
              ]
            : null,
      ),
      child: child,
    );
  }
}

class _TileLabel extends StatelessWidget {
  const _TileLabel({
    required this.name,
    required this.muted,
    this.self = false,
  });

  final String name;
  final bool muted;
  final bool self;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 20, 8, 8),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.transparent, Color(0xB3000000)],
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                self ? '$name ${l10n.callYouSuffix}' : name,
                style: AppTextStyles.caption.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: muted
                    ? AppColors.danger.withValues(alpha: 0.85)
                    : Colors.white.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: Icon(
                muted
                    ? IconsaxPlusBold.microphone_slash
                    : IconsaxPlusBold.microphone_2,
                size: 11,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FloatingPill extends StatelessWidget {
  const _FloatingPill({required this.text, required this.color, super.key});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(99),
          ),
          child: Text(
            text,
            style: AppTextStyles.caption.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        )
        .animate()
        .fadeIn(duration: 180.ms)
        .slideY(begin: -0.3, end: 0, duration: 220.ms, curve: Curves.easeOut);
  }
}

class _PeoplePanel extends StatelessWidget {
  const _PeoplePanel({
    required this.open,
    required this.meeting,
    required this.micOn,
    required this.camOn,
    required this.joined,
    required this.onClose,
  });

  final bool open;
  final Meeting meeting;
  final bool micOn;
  final bool camOn;
  final List<_LiveParticipant> joined;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOut,
      width: open ? 220 : 0,
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        border: Border(
          left: BorderSide(color: AppColors.surface.withValues(alpha: 0.08)),
        ),
      ),
      child: open
          ? Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 8, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          l10n.callParticipantsTitle(joined.length + 1),
                          style: AppTextStyles.label.copyWith(
                            color: AppColors.surface,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: onClose,
                        child: Icon(
                          IconsaxPlusBold.close_circle,
                          size: 18,
                          color: AppColors.surface.withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    children: [
                      _PeopleRow(
                        name: l10n.callYou,
                        self: true,
                        muted: !micOn,
                        camOff: !camOn,
                        color: AppColors.primary,
                      ),
                      for (final p in joined)
                        _PeopleRow(
                          name: p.name,
                          muted: p.muted,
                          camOff: !p.camOn,
                          speaking: p.speaking,
                        ),
                    ],
                  ),
                ),
              ],
            )
          : const SizedBox.shrink(),
    );
  }
}

class _PeopleRow extends StatelessWidget {
  const _PeopleRow({
    required this.name,
    required this.muted,
    required this.camOff,
    this.color,
    this.speaking = false,
    this.self = false,
  });

  final String name;
  final bool muted;
  final bool camOff;
  final Color? color;
  final bool speaking;
  final bool self;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: speaking
            ? AppColors.primary.withValues(alpha: 0.14)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Row(
        children: [
          AppAvatar(name: name, size: 30, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              self ? '$name ${l10n.callYouSuffix}' : name,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.surface,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Icon(
            muted
                ? IconsaxPlusBold.microphone_slash
                : IconsaxPlusBold.microphone_2,
            size: 14,
            color: muted
                ? AppColors.danger
                : AppColors.surface.withValues(alpha: 0.5),
          ),
          const SizedBox(width: 6),
          Icon(
            camOff ? IconsaxPlusBold.video_slash : IconsaxPlusBold.video,
            size: 14,
            color: camOff
                ? AppColors.danger
                : AppColors.surface.withValues(alpha: 0.5),
          ),
        ],
      ),
    );
  }
}

class _CallControls extends StatelessWidget {
  const _CallControls({
    required this.micOn,
    required this.camOn,
    required this.sharing,
    required this.pickerOpen,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onToggleSharing,
    required this.onTogglePicker,
    required this.onSendReaction,
    required this.onEndCall,
  });

  final bool micOn;
  final bool camOn;
  final bool sharing;
  final bool pickerOpen;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onToggleSharing;
  final VoidCallback onTogglePicker;
  final void Function(String emoji) onSendReaction;
  final VoidCallback onEndCall;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: AppColors.surface.withValues(alpha: 0.08)),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (pickerOpen)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child:
                  Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.darkSurfaceAlt,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: AppColors.surface.withValues(alpha: 0.1),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (final e in _reactions)
                              GestureDetector(
                                onTap: () => onSendReaction(e),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                  ),
                                  child: Text(
                                    e,
                                    style: const TextStyle(fontSize: 22),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      )
                      .animate()
                      .fadeIn(duration: 160.ms)
                      .scale(
                        begin: const Offset(0.9, 0.9),
                        end: const Offset(1, 1),
                        duration: 160.ms,
                      ),
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Expanded(
                child: _ControlButton(
                  active: micOn,
                  icon: micOn
                      ? IconsaxPlusBold.microphone_2
                      : IconsaxPlusBold.microphone_slash,
                  label: l10n.callMic,
                  onTap: onToggleMic,
                ),
              ),
              Expanded(
                child: _ControlButton(
                  active: camOn,
                  icon: camOn
                      ? IconsaxPlusBold.video
                      : IconsaxPlusBold.video_slash,
                  label: l10n.callCamera,
                  onTap: onToggleCam,
                ),
              ),
              Expanded(
                child: _ControlButton(
                  active: !sharing,
                  accentWhenActive: sharing,
                  icon: IconsaxPlusBold.monitor,
                  label: l10n.callScreen,
                  onTap: onToggleSharing,
                ),
              ),
              Expanded(
                child: _ControlButton(
                  active: !pickerOpen,
                  accentWhenActive: pickerOpen,
                  icon: IconsaxPlusBold.emoji_happy,
                  label: l10n.callReaction,
                  onTap: onTogglePicker,
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: onEndCall,
                  child: Container(
                    height: 52,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      borderRadius: BorderRadius.circular(99),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.danger.withValues(alpha: 0.35),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          IconsaxPlusBold.call_slash,
                          size: 20,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            l10n.callEnd,
                            style: AppTextStyles.button.copyWith(
                              color: Colors.white,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    required this.active,
    required this.icon,
    required this.label,
    required this.onTap,
    this.accentWhenActive = false,
  });

  /// `true` — o'chirilmagan/oddiy holat (masalan mikrofon yoqiq).
  /// `false` — o'chirilgan (qizil fon), masalan mikrofon o'chiq.
  final bool active;
  final bool accentWhenActive;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = !active
        ? AppColors.danger.withValues(alpha: 0.9)
        : accentWhenActive
        ? AppColors.accent
        : AppColors.surface.withValues(alpha: 0.12);

    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Icon(icon, size: 20, color: Colors.white),
          ),
          const SizedBox(height: 5),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: AppColors.surface.withValues(alpha: 0.6),
              fontSize: 10.5,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/* ============================================================
   Umumiy kichik widgetlar
   ============================================================ */

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active
              ? AppColors.primary
              : AppColors.surface.withValues(alpha: 0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          size: 18,
          color: active
              ? Colors.white
              : AppColors.surface.withValues(alpha: 0.75),
        ),
      ),
    );
  }
}

class _PrimaryPillButton extends StatelessWidget {
  const _PrimaryPillButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(AppRadii.md),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.3),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 19, color: Colors.white),
            const SizedBox(width: 8),
            Text(
              label,
              style: AppTextStyles.button.copyWith(color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

class _SecondaryPillButton extends StatelessWidget {
  const _SecondaryPillButton({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surface.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 17,
              color: AppColors.surface.withValues(alpha: 0.85),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                style: AppTextStyles.bodyStrong.copyWith(
                  color: AppColors.surface.withValues(alpha: 0.85),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
