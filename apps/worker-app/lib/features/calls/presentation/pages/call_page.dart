import 'dart:async';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';

/// To'liq-ekran 1:1 WebRTC qo'ng'iroq sahifasi (`/call/:id`).
///
/// [CallCubit] holatiga qarab bosqichlarni ko'rsatadi: kiruvchi jiringlash
/// (qabul/rad), chiquvchi "Chaqirilmoqda…", ulanmoqda/faol (video: remote
/// to'liq ekran + lokal PiP; audio: avatar) va tugash ekrani. Tugagach
/// sahifa avtomatik yopiladi.
class CallPage extends StatelessWidget {
  const CallPage({required this.callId, super.key});

  final String callId;

  @override
  Widget build(BuildContext context) {
    return BlocListener<CallCubit, CallState>(
      listenWhen: (prev, curr) =>
          prev.phase != CallPhase.ended && curr.phase == CallPhase.ended,
      listener: (context, state) {
        // Tugash ekranini qisqa ko'rsatib, so'ng sahifani yopamiz.
        Timer(const Duration(milliseconds: 1400), () {
          if (!context.mounted) return;
          context.read<CallCubit>().reset();
          if (context.canPop()) context.pop();
        });
      },
      child: BlocBuilder<CallCubit, CallState>(
        builder: (context, state) {
          return PopScope(
            canPop:
                state.phase == CallPhase.ended ||
                state.phase == CallPhase.idle,
            onPopInvokedWithResult: (didPop, _) {
              if (didPop) return;
              _leave(context, state);
            },
            child: Scaffold(
              backgroundColor: AppColors.ink,
              body: _body(context, state),
            ),
          );
        },
      ),
    );
  }

  /// Ortga bosilganda bosqichga qarab bekor/rad/tugatish.
  void _leave(BuildContext context, CallState state) {
    final cubit = context.read<CallCubit>();
    switch (state.phase) {
      case CallPhase.incoming:
        cubit.reject();
      case CallPhase.outgoing:
        cubit.cancel();
      case CallPhase.connecting:
      case CallPhase.active:
        cubit.hangUp();
      case CallPhase.ended:
      case CallPhase.idle:
        if (context.canPop()) context.pop();
    }
  }

  Widget _body(BuildContext context, CallState state) {
    final cubit = context.read<CallCubit>();
    return switch (state.phase) {
      CallPhase.incoming => _IncomingView(
        state: state,
        onAccept: cubit.accept,
        onReject: cubit.reject,
      ),
      CallPhase.outgoing => _RingingView(
        state: state,
        label: 'Chaqirilmoqda…',
        onCancel: cubit.cancel,
      ),
      CallPhase.connecting || CallPhase.active => _ActiveView(
        state: state,
        localRenderer: cubit.localRenderer,
        remoteRenderer: cubit.remoteRenderer,
        onToggleMic: cubit.toggleMic,
        onToggleCam: cubit.toggleCam,
        onSwitchCamera: () => unawaited(cubit.switchCamera()),
        onHangUp: cubit.hangUp,
      ),
      CallPhase.ended => _EndedView(state: state),
      CallPhase.idle => const SizedBox.shrink(),
    };
  }
}

String _fmtDuration(Duration d) {
  final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  final h = d.inHours;
  return h > 0 ? '$h:$m:$s' : '$m:$s';
}

String _mediaLabel(CallMedia media) =>
    media == CallMedia.video ? "Video qo'ng'iroq" : "Ovozli qo'ng'iroq";

/* ============================================================
   KIRUVCHI (ring)
   ============================================================ */

class _IncomingView extends StatelessWidget {
  const _IncomingView({
    required this.state,
    required this.onAccept,
    required this.onReject,
  });

  final CallState state;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final peer = state.peer;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 40, 24, 40),
        child: Column(
          children: [
            const Spacer(),
            AppAvatar(
              name: peer?.name ?? '',
              photoUrl: peer?.avatar,
              color: AppColors.primary,
              size: 128,
            ),
            const SizedBox(height: 24),
            Text(
              peer?.name ?? 'Nomaʼlum',
              style: AppTextStyles.h1.copyWith(color: AppColors.surface),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              '${_mediaLabel(state.media)} • Kiruvchi',
              style: AppTextStyles.body.copyWith(
                color: AppColors.surface.withValues(alpha: 0.6),
              ),
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _CallActionButton(
                  icon: IconsaxPlusBold.call_slash,
                  color: AppColors.danger,
                  label: 'Rad etish',
                  onTap: onReject,
                ),
                _CallActionButton(
                  icon: IconsaxPlusBold.call,
                  color: AppColors.primary,
                  label: 'Qabul qilish',
                  onTap: onAccept,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/* ============================================================
   CHIQUVCHI (chaqirilmoqda)
   ============================================================ */

class _RingingView extends StatelessWidget {
  const _RingingView({
    required this.state,
    required this.label,
    required this.onCancel,
  });

  final CallState state;
  final String label;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final peer = state.peer;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 40, 24, 40),
        child: Column(
          children: [
            const Spacer(),
            AppAvatar(
              name: peer?.name ?? '',
              photoUrl: peer?.avatar,
              color: AppColors.primary,
              size: 128,
            ),
            const SizedBox(height: 24),
            Text(
              peer?.name ?? '',
              style: AppTextStyles.h1.copyWith(color: AppColors.surface),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              '${_mediaLabel(state.media)} • $label',
              style: AppTextStyles.body.copyWith(
                color: AppColors.surface.withValues(alpha: 0.6),
              ),
            ),
            const Spacer(),
            _CallActionButton(
              icon: IconsaxPlusBold.call_slash,
              color: AppColors.danger,
              label: 'Bekor qilish',
              onTap: onCancel,
            ),
          ],
        ),
      ),
    );
  }
}

/* ============================================================
   ULANMOQDA / FAOL
   ============================================================ */

class _ActiveView extends StatelessWidget {
  const _ActiveView({
    required this.state,
    required this.localRenderer,
    required this.remoteRenderer,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onSwitchCamera,
    required this.onHangUp,
  });

  final CallState state;
  final RTCVideoRenderer localRenderer;
  final RTCVideoRenderer remoteRenderer;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onSwitchCamera;
  final VoidCallback onHangUp;

  bool get _connecting => state.phase == CallPhase.connecting;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Suhbatdosh (remote) — video bo'lsa to'liq ekran, aks holda avatar.
        if (state.isVideo && state.remoteVideoReady)
          RTCVideoView(
            remoteRenderer,
            objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
          )
        else
          _RemotePlaceholder(state: state),

        // Lokal PiP (video qo'ng'iroqda, kamera yoniqda).
        if (state.isVideo && state.camOn)
          Positioned(
            right: 16,
            top: MediaQuery.of(context).padding.top + 16,
            child: _LocalPip(
              renderer: localRenderer,
              mirror: state.frontCamera,
            ),
          ),

        // Yuqori panel — ism + holat/sanog'.
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  state.peer?.name ?? '',
                  style: AppTextStyles.h3.copyWith(color: AppColors.surface),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  _connecting ? 'Ulanmoqda…' : _fmtDuration(state.elapsed),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.surface.withValues(alpha: 0.7),
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Pastki boshqaruv paneli.
        Align(
          alignment: Alignment.bottomCenter,
          child: _ControlBar(
            state: state,
            onToggleMic: onToggleMic,
            onToggleCam: onToggleCam,
            onSwitchCamera: onSwitchCamera,
            onHangUp: onHangUp,
          ),
        ),
      ],
    );
  }
}

class _RemotePlaceholder extends StatelessWidget {
  const _RemotePlaceholder({required this.state});

  final CallState state;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.darkSurfaceAlt, AppColors.darkCanvas],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppAvatar(
              name: state.peer?.name ?? '',
              photoUrl: state.peer?.avatar,
              color: AppColors.primary,
              size: 120,
            ),
            const SizedBox(height: 20),
            Text(
              state.peer?.name ?? '',
              style: AppTextStyles.h2.copyWith(color: AppColors.surface),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _LocalPip extends StatelessWidget {
  const _LocalPip({required this.renderer, required this.mirror});

  final RTCVideoRenderer renderer;
  final bool mirror;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 108,
        height: 152,
        child: RTCVideoView(
          renderer,
          objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
          mirror: mirror,
        ),
      ),
    );
  }
}

class _ControlBar extends StatelessWidget {
  const _ControlBar({
    required this.state,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onSwitchCamera,
    required this.onHangUp,
  });

  final CallState state;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onSwitchCamera;
  final VoidCallback onHangUp;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.4),
          borderRadius: BorderRadius.circular(28),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _RoundControl(
              icon: state.micOn
                  ? IconsaxPlusBold.microphone_2
                  : IconsaxPlusBold.microphone_slash,
              active: !state.micOn,
              onTap: onToggleMic,
            ),
            if (state.isVideo) ...[
              _RoundControl(
                icon: state.camOn
                    ? IconsaxPlusBold.video
                    : IconsaxPlusBold.video_slash,
                active: !state.camOn,
                onTap: onToggleCam,
              ),
              _RoundControl(
                icon: IconsaxPlusLinear.refresh,
                onTap: onSwitchCamera,
              ),
            ],
            _RoundControl(
              icon: IconsaxPlusBold.call_slash,
              background: AppColors.danger,
              onTap: onHangUp,
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundControl extends StatelessWidget {
  const _RoundControl({
    required this.icon,
    required this.onTap,
    this.active = false,
    this.background,
  });

  final IconData icon;
  final VoidCallback onTap;

  /// `true` bo'lsa "o'chirilgan" (masalan mic-off) ko'rinishi.
  final bool active;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final bg = background ??
        (active
            ? AppColors.surface
            : AppColors.surface.withValues(alpha: 0.16));
    final fg = background != null
        ? Colors.white
        : (active ? AppColors.ink : Colors.white);
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        width: 56,
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Icon(icon, color: fg, size: 24),
      ),
    );
  }
}

/* ============================================================
   TUGADI
   ============================================================ */

class _EndedView extends StatelessWidget {
  const _EndedView({required this.state});

  final CallState state;

  String get _reasonText {
    switch (state.endReason) {
      case CallEndReason.rejected:
        return 'Rad etildi';
      case CallEndReason.cancelled:
        return 'Bekor qilindi';
      case CallEndReason.busy:
        return 'Band';
      case CallEndReason.missed:
        return "Javobsiz qo'ng'iroq";
      case CallEndReason.failed:
        return state.errorMessage ?? 'Xatolik';
      case CallEndReason.hangup:
      case CallEndReason.remoteEnded:
        return state.elapsed > Duration.zero
            ? 'Tugadi • ${_fmtDuration(state.elapsed)}'
            : 'Tugadi';
      case CallEndReason.none:
        return 'Tugadi';
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppAvatar(
              name: state.peer?.name ?? '',
              photoUrl: state.peer?.avatar,
              color: AppColors.inkMuted,
              size: 96,
            ),
            const SizedBox(height: 18),
            Text(
              state.peer?.name ?? '',
              style: AppTextStyles.h2.copyWith(color: AppColors.surface),
            ),
            const SizedBox(height: 8),
            Text(
              _reasonText,
              style: AppTextStyles.body.copyWith(
                color: AppColors.surface.withValues(alpha: 0.6),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// Kiruvchi/chiquvchi ekrandagi katta yumaloq amal tugmasi (matnli).
class _CallActionButton extends StatelessWidget {
  const _CallActionButton({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: () {
            HapticFeedback.mediumImpact();
            onTap();
          },
          child: Container(
            width: 72,
            height: 72,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: Icon(icon, color: Colors.white, size: 30),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          label,
          style: AppTextStyles.caption.copyWith(
            color: AppColors.surface.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }
}
