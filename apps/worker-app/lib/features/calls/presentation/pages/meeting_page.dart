import 'dart:async';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:worker_app/features/calls/presentation/bloc/meeting_cubit.dart';

/// To'liq ekranli guruh qo'ng'irog'i (yig'ilish, Zoom kabi): taklif →
/// ulanish → jonli to'r → tugash. Navigatsiyani `app.dart`dagi global host
/// boshqaradi; sahifa faqat tugaganda o'zini yopadi.
class MeetingPage extends StatelessWidget {
  const MeetingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocListener<MeetingCubit, MeetingState>(
      listenWhen: (prev, curr) =>
          curr.phase != prev.phase &&
          (curr.phase == MeetingPhase.ended ||
              curr.phase == MeetingPhase.error ||
              curr.phase == MeetingPhase.idle),
      listener: (context, state) {
        final delay = state.phase == MeetingPhase.idle
            ? Duration.zero
            : const Duration(milliseconds: 1600);
        Timer(delay, () {
          if (!context.mounted) return;
          context.read<MeetingCubit>().reset();
          if (context.canPop()) context.pop();
        });
      },
      child: BlocBuilder<MeetingCubit, MeetingState>(
        builder: (context, state) {
          final cubit = context.read<MeetingCubit>();
          return PopScope(
            canPop:
                state.phase == MeetingPhase.ended ||
                state.phase == MeetingPhase.error ||
                state.phase == MeetingPhase.idle,
            onPopInvokedWithResult: (didPop, _) {
              if (didPop) return;
              if (state.phase == MeetingPhase.incoming) {
                cubit.decline();
              } else {
                cubit.leave();
              }
            },
            child: Scaffold(
              backgroundColor: AppColors.ink,
              body: switch (state.phase) {
                MeetingPhase.incoming => _InviteView(state: state),
                MeetingPhase.joining => _JoiningView(state: state),
                MeetingPhase.live => _LiveView(state: state),
                MeetingPhase.ended ||
                MeetingPhase.error => _EndView(state: state),
                MeetingPhase.idle => const SizedBox.shrink(),
              },
            ),
          );
        },
      ),
    );
  }
}

String _clock(Duration d) {
  final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return d.inHours > 0 ? '${d.inHours}:$m:$s' : '$m:$s';
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  return parts.take(2).map((p) => p.characters.first.toUpperCase()).join();
}

/* ============================== TAKLIF ============================== */

class _InviteView extends StatelessWidget {
  const _InviteView({required this.state});

  final MeetingState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<MeetingCubit>();
    const white = AppColors.surface;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 48, 24, 32),
        child: Column(
          children: [
            const Spacer(),
            Container(
              width: 112,
              height: 112,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.18),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(
                state.video ? IconsaxPlusBold.video : IconsaxPlusBold.call,
                size: 48,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              state.title,
              textAlign: TextAlign.center,
              style: AppTextStyles.h1.copyWith(color: white),
            ),
            const SizedBox(height: 8),
            Text(
              state.hostName.isEmpty
                  ? "Guruh qo'ng'irog'iga taklif"
                  : "${state.hostName} sizni guruh qo'ng'irog'iga "
                        'chaqirmoqda',
              textAlign: TextAlign.center,
              style: AppTextStyles.body.copyWith(
                color: white.withValues(alpha: 0.65),
              ),
            ),
            const Spacer(flex: 2),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _BigAction(
                  icon: IconsaxPlusBold.call_slash,
                  label: 'Rad etish',
                  color: AppColors.danger,
                  onTap: cubit.decline,
                ),
                _BigAction(
                  icon: state.video
                      ? IconsaxPlusBold.video
                      : IconsaxPlusBold.call,
                  label: "Qo'shilish",
                  color: AppColors.primary,
                  onTap: () => unawaited(cubit.accept()),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BigAction extends StatelessWidget {
  const _BigAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.mediumImpact();
          onTap();
        },
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              child: Icon(icon, color: Colors.white, size: 30),
            ),
            const SizedBox(height: 10),
            Text(
              label,
              style: AppTextStyles.caption.copyWith(
                color: AppColors.surface.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ============================== ULANISH ============================== */

class _JoiningView extends StatelessWidget {
  const _JoiningView({required this.state});

  final MeetingState state;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 44,
            height: 44,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            state.title,
            style: AppTextStyles.h3.copyWith(color: AppColors.surface),
          ),
          const SizedBox(height: 6),
          Text(
            'Ulanmoqda…',
            style: AppTextStyles.caption.copyWith(
              color: AppColors.surface.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}

/* ============================== JONLI ============================== */

class _LiveView extends StatelessWidget {
  const _LiveView({required this.state});

  final MeetingState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<MeetingCubit>();
    final tiles = <Widget>[
      _Tile(
        key: const ValueKey('self'),
        name: 'Siz',
        stream: cubit.localStream,
        showVideo: state.hasCamera && state.camOn,
        micOff: !state.micOn,
        mirror: true,
        connected: true,
      ),
      for (final m in state.members)
        _Tile(
          key: ValueKey(m.id),
          name: m.name,
          avatar: m.avatar,
          stream: cubit.streamOf(m.id),
          showVideo: m.video && m.hasStream,
          micOff: !m.audio,
          connected: m.connected || m.hasStream,
        ),
    ];

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'JONLI',
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        state.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: AppColors.surface,
                        ),
                      ),
                      Text(
                        _clock(state.elapsed),
                        style: AppTextStyles.caption.copyWith(
                          color: AppColors.surface.withValues(alpha: 0.6),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        IconsaxPlusBold.people,
                        size: 16,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${tiles.length}',
                        style: AppTextStyles.caption.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: _Grid(tiles: tiles),
            ),
          ),
          if (state.members.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Boshqa ishtirokchilar kutilmoqda…',
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.surface.withValues(alpha: 0.6),
                ),
              ),
            ),
          _Controls(state: state),
        ],
      ),
    );
  }
}

/// 1 → to'liq; 2 → ustma-ust; 3-4 → 2×2; 5-6 → 2×3; ko'p → 2 ustun, scroll.
class _Grid extends StatelessWidget {
  const _Grid({required this.tiles});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) {
    final n = tiles.length;
    if (n == 1) return tiles.first;
    if (n == 2) {
      return Column(
        children: [
          Expanded(child: tiles[0]),
          const SizedBox(height: 8),
          Expanded(child: tiles[1]),
        ],
      );
    }
    return LayoutBuilder(
      builder: (context, box) {
        final rows = n <= 4 ? 2 : (n <= 6 ? 3 : 4);
        final h = (box.maxHeight - 8 * (rows - 1)) / rows;
        final w = (box.maxWidth - 8) / 2;
        return GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: w / h.clamp(120, double.infinity),
          physics: n > 8
              ? const BouncingScrollPhysics()
              : const NeverScrollableScrollPhysics(),
          children: tiles,
        );
      },
    );
  }
}

class _Tile extends StatefulWidget {
  const _Tile({
    required this.name,
    required this.stream,
    required this.showVideo,
    required this.micOff,
    required this.connected,
    this.avatar,
    this.mirror = false,
    super.key,
  });

  final String name;
  final String? avatar;
  final Object? stream;
  final bool showVideo;
  final bool micOff;
  final bool mirror;
  final bool connected;

  @override
  State<_Tile> createState() => _TileState();
}

class _TileState extends State<_Tile> {
  RTCVideoRenderer? _renderer;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    unawaited(_attach());
  }

  @override
  void didUpdateWidget(covariant _Tile old) {
    super.didUpdateWidget(old);
    if (old.stream != widget.stream) unawaited(_attach());
  }

  Future<void> _attach() async {
    final stream = widget.stream;
    if (stream is! MediaStream) return;
    try {
      final r = _renderer ?? RTCVideoRenderer();
      if (_renderer == null) {
        await r.initialize();
        _renderer = r;
      }
      r.srcObject = stream;
      if (mounted) setState(() => _ready = true);
    } on Object {
      // renderer ishga tushmadi — avatar ko'rinadi
    }
  }

  @override
  void dispose() {
    final r = _renderer;
    if (r != null) {
      r.srcObject = null;
      unawaited(r.dispose());
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final renderer = _renderer;
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: ColoredBox(
        color: AppColors.darkSurfaceAlt,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Video doim chiziladi (audio shu orqali eshitiladi); kamera
            // o'chiq bo'lsa ustidan avatar.
            if (renderer != null && _ready)
              RTCVideoView(
                renderer,
                mirror: widget.mirror,
                objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
              ),
            if (!widget.showVideo || !_ready)
              ColoredBox(
                color: AppColors.darkSurfaceAlt,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: AppColors.primary,
                        backgroundImage:
                            widget.avatar != null && widget.avatar!.isNotEmpty
                            ? NetworkImage(widget.avatar!)
                            : null,
                        child: widget.avatar == null || widget.avatar!.isEmpty
                            ? Text(
                                _initials(widget.name),
                                style: AppTextStyles.h3.copyWith(
                                  color: Colors.white,
                                ),
                              )
                            : null,
                      ),
                      if (!widget.connected) ...[
                        const SizedBox(height: 8),
                        Text(
                          'ulanmoqda…',
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.surface.withValues(alpha: 0.55),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            Positioned(
              left: 8,
              right: 8,
              bottom: 8,
              child: Row(
                children: [
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        widget.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption.copyWith(
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  if (widget.micOff) ...[
                    const SizedBox(width: 6),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: const BoxDecoration(
                        color: AppColors.danger,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        IconsaxPlusBold.microphone_slash,
                        size: 13,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  const _Controls({required this.state});

  final MeetingState state;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<MeetingCubit>();
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _Round(
            icon: state.micOn
                ? IconsaxPlusBold.microphone_2
                : IconsaxPlusBold.microphone_slash,
            off: !state.micOn,
            label: state.micOn ? "Ovozni o'chirish" : 'Ovozni yoqish',
            onTap: cubit.toggleMic,
          ),
          if (state.hasCamera) ...[
            _Round(
              icon: state.camOn
                  ? IconsaxPlusBold.video
                  : IconsaxPlusBold.video_slash,
              off: !state.camOn,
              label: state.camOn ? "Kamerani o'chirish" : 'Kamerani yoqish',
              onTap: cubit.toggleCam,
            ),
            _Round(
              icon: IconsaxPlusLinear.refresh,
              label: 'Kamerani almashtirish',
              onTap: () => unawaited(cubit.switchCamera()),
            ),
          ],
          _Round(
            icon: state.speakerOn
                ? IconsaxPlusBold.volume_high
                : IconsaxPlusBold.volume_slash,
            off: !state.speakerOn,
            label: state.speakerOn ? 'Karnay' : 'Quloqchin',
            onTap: () => unawaited(cubit.toggleSpeaker()),
          ),
          _Round(
            icon: IconsaxPlusBold.call_slash,
            background: AppColors.danger,
            label: 'Chiqish',
            onTap: cubit.leave,
          ),
        ],
      ),
    );
  }
}

class _Round extends StatelessWidget {
  const _Round({
    required this.icon,
    required this.label,
    required this.onTap,
    this.off = false,
    this.background,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool off;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final bg =
        background ??
        (off ? AppColors.surface : AppColors.surface.withValues(alpha: 0.16));
    final fg = background != null
        ? Colors.white
        : (off ? AppColors.ink : Colors.white);
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: Icon(icon, color: fg, size: 22),
        ),
      ),
    );
  }
}

/* ============================== TUGADI ============================== */

class _EndView extends StatelessWidget {
  const _EndView({required this.state});

  final MeetingState state;

  @override
  Widget build(BuildContext context) {
    final error = state.phase == MeetingPhase.error;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              error ? IconsaxPlusBold.danger : IconsaxPlusBold.tick_circle,
              size: 56,
              color: error ? AppColors.danger : AppColors.primary,
            ),
            const SizedBox(height: 16),
            Text(
              state.message ?? "Yig'ilish yakunlandi",
              textAlign: TextAlign.center,
              style: AppTextStyles.h3.copyWith(color: AppColors.surface),
            ),
            if (!error && state.elapsed > Duration.zero) ...[
              const SizedBox(height: 6),
              Text(
                _clock(state.elapsed),
                style: AppTextStyles.caption.copyWith(
                  color: AppColors.surface.withValues(alpha: 0.6),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
