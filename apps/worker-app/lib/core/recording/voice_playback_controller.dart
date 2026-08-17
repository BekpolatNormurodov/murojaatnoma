import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

/// `just_audio`ning [AudioPlayer]ini o'raydigan yupqa controller — ovozli
/// xabar pufakchasi/tile'i play/pause + progress ko'rsatishi uchun kerakli
/// minimal holatni chiqaradi, `just_audio` APIsini chaqiruvchi widget'larga
/// oqizmasdan.
///
/// Pleer FAQAT birinchi [toggle] chaqirilganda ochiladi (lazy) — shu
/// tufayli uzun biriktirma ro'yxatidagi hali bosilmagan tile'lar platforma
/// kanaliga umuman tegmaydi (masalan widget testlarda xavfsiz — plagin
/// faqat haqiqiy foydalanuvchi bosishida chaqiriladi).
///
/// Har qanday I/O yoki kodek xatosi ushlanadi ([hasError] orqali
/// chaqiruvchiga signal beriladi, [onError] callback bilan) — hech qachon
/// uncaught qolmaydi.
class VoicePlaybackController extends ChangeNotifier {
  VoicePlaybackController(this.path, {this.onError});

  /// Ijro etiladigan lokal (yoki masofaviy, kelajakda) fayl yo'li.
  final String path;

  /// Ijro/yuklash xatosi yuz berganda chaqiriladi (masalan `AppAlert`
  /// ko'rsatish uchun) — controller o'zi `BuildContext`ga ega emas.
  final VoidCallback? onError;

  AudioPlayer? _player;
  StreamSubscription<Duration>? _positionSub;
  StreamSubscription<PlayerState>? _stateSub;

  bool _loading = false;
  bool _hasError = false;
  Duration _position = Duration.zero;
  Duration? _duration;

  bool get isLoading => _loading;
  bool get hasError => _hasError;
  Duration get position => _position;
  Duration? get duration => _duration;

  bool get isPlaying {
    final player = _player;
    if (player == null) return false;
    if (player.processingState == ProcessingState.completed) return false;
    return player.playing;
  }

  /// 0..1 — davomiylik hali noma'lum bo'lsa `0`.
  double get progress {
    final total = _duration?.inMilliseconds ?? 0;
    if (total <= 0) return 0;
    return (_position.inMilliseconds / total).clamp(0, 1).toDouble();
  }

  /// Play/pause almashtiradi — pleer hali ochilmagan bo'lsa avval ochadi.
  Future<void> toggle() async {
    final player = await _ensurePlayer();
    if (player == null) return;

    try {
      if (isPlaying) {
        await player.pause();
      } else {
        if (player.processingState == ProcessingState.completed) {
          await player.seek(Duration.zero);
        }
        unawaited(player.play());
      }
    } on Object {
      _hasError = true;
      onError?.call();
    } finally {
      notifyListeners();
    }
  }

  Future<AudioPlayer?> _ensurePlayer() async {
    if (_player != null) return _player;

    _loading = true;
    notifyListeners();

    final player = AudioPlayer();
    try {
      final duration = await player.setFilePath(path);
      _player = player;
      _duration = duration;
      _positionSub = player.positionStream.listen((position) {
        _position = position;
        notifyListeners();
      });
      _stateSub = player.playerStateStream.listen((state) {
        _duration = player.duration ?? _duration;
        notifyListeners();
      });
      return player;
    } on Object {
      _hasError = true;
      onError?.call();
      unawaited(player.dispose());
      return null;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    unawaited(_positionSub?.cancel());
    unawaited(_stateSub?.cancel());
    unawaited(_player?.dispose());
    super.dispose();
  }
}
