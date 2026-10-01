import 'dart:async';

import 'package:app_core/src/network/network_status.dart';
import 'package:flutter/material.dart';

/// Ilova ustida (status-bar ostida) kichik suzuvchi "pill" — internet holati:
///  * oflayn — "Internet yo'q · saqlangan ma'lumot" (qolib turadi);
///  * sekin — "Internet sekin" (4 s);
///  * qaytdi — "Internet tiklandi" (2 s).
/// Teginishlarni to'smaydi (`IgnorePointer`). `MaterialApp.builder`da o'raladi.
class NetworkBanner extends StatefulWidget {
  const NetworkBanner({required this.child, super.key});

  final Widget child;

  @override
  State<NetworkBanner> createState() => _NetworkBannerState();
}

enum _Shown { none, offline, slow, back }

class _NetworkBannerState extends State<NetworkBanner> {
  final _status = NetworkStatus.instance;
  _Shown _shown = _Shown.none;
  NetworkQuality _last = NetworkStatus.instance.quality.value;
  Timer? _hide;

  @override
  void initState() {
    super.initState();
    _status.quality.addListener(_onChange);
  }

  @override
  void dispose() {
    _status.quality.removeListener(_onChange);
    _hide?.cancel();
    super.dispose();
  }

  void _onChange() {
    final q = _status.quality.value;
    final prev = _last;
    _last = q;
    _hide?.cancel();
    setState(() {
      switch (q) {
        case NetworkQuality.offline:
          _shown = _Shown.offline;
        case NetworkQuality.slow:
          _shown = _Shown.slow;
          _hide = Timer(const Duration(seconds: 4), _clear);
        case NetworkQuality.online:
          if (prev == NetworkQuality.offline) {
            _shown = _Shown.back;
            _hide = Timer(const Duration(seconds: 2), _clear);
          } else {
            _shown = _Shown.none;
          }
      }
    });
  }

  void _clear() {
    if (mounted) setState(() => _shown = _Shown.none);
  }

  @override
  Widget build(BuildContext context) {
    final (color, icon, text) = switch (_shown) {
      _Shown.offline => (
        const Color(0xFF334155),
        Icons.cloud_off_rounded,
        "Internet yo'q · saqlangan ma'lumot",
      ),
      _Shown.slow => (
        const Color(0xFFB45309),
        Icons.network_check_rounded,
        'Internet sekin',
      ),
      _Shown.back => (
        const Color(0xFF059669),
        Icons.cloud_done_rounded,
        'Internet tiklandi',
      ),
      _Shown.none => (const Color(0x00000000), Icons.circle, ''),
    };
    final top = MediaQuery.paddingOf(context).top;
    return Stack(
      children: [
        widget.child,
        Positioned(
          top: top + 6,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              transitionBuilder: (child, a) => FadeTransition(
                opacity: a,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0, -0.6),
                    end: Offset.zero,
                  ).animate(a),
                  child: child,
                ),
              ),
              child: _shown == _Shown.none
                  ? const SizedBox.shrink(key: ValueKey('none'))
                  : Center(
                      key: ValueKey(_shown),
                      child: Semantics(
                        liveRegion: true,
                        label: text,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: color,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x33000000),
                                blurRadius: 12,
                                offset: Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(icon, size: 15, color: Colors.white),
                                const SizedBox(width: 6),
                                Text(
                                  text,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    decoration: TextDecoration.none,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}
