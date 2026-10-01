import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:worker_app/features/calls/data/datasources/call_remote_data_source.dart';
import 'package:worker_app/features/calls/domain/repositories/call_repository.dart';

/// Bitta uzoq ishtirokchi bilan WebRTC ulanishi — `MeetingCubit` uchun
/// platformadan mustaqil qatlam (testlarda soxta, ilovada `flutter_webrtc`).
abstract class MeetingPeer {
  /// Offer yasaydi va lokal tavsif sifatida o'rnatadi: `{sdp, type}`.
  Future<Map<String, dynamic>> createOffer();

  /// (Remote offer o'rnatilgach) answer yasaydi va o'rnatadi.
  Future<Map<String, dynamic>> createAnswer();

  Future<void> setRemote(Map<String, dynamic> description);

  Future<void> addIce(Map<String, dynamic> candidate);

  /// Chiquvchi videoni cheklaydi (mesh: ishtirokchi ko'paysa — yengilroq).
  Future<void> setMaxVideoBitrate(int bps);

  Future<void> close();

  /// Lokal ICE nomzodi tayyor — signal orqali yuboriladi.
  void Function(Map<String, dynamic> candidate)? onIce;

  /// Uzoq tomon oqimi keldi (opaque — UI `RTCVideoRenderer`ga ulaydi).
  void Function(Object stream)? onRemoteStream;

  /// Media ulandi (`true`) / uzildi (`false`).
  void Function({required bool connected})? onConnection;
}

/// Lokal media (mikrofon + ixtiyoriy kamera) va peer yaratish.
abstract class MeetingMediaEngine {
  /// Kamera bilan (bo'lmasa — faqat mikrofon) lokal oqim. Mikrofonga ham
  /// ruxsat bo'lmasa `null`.
  Future<Object?> openLocal({required bool video});

  /// Lokal oqimda video trek bormi.
  bool hasVideo(Object local);

  void setAudioEnabled(Object local, {required bool enabled});

  void setVideoEnabled(Object local, {required bool enabled});

  Future<void> switchCamera(Object local);

  Future<void> setSpeakerphone({required bool on});

  Future<List<Map<String, dynamic>>> iceServers();

  Future<MeetingPeer> createPeer({
    required Object local,
    required List<Map<String, dynamic>> iceServers,
  });

  Future<void> disposeLocal(Object local);
}

/// `flutter_webrtc` asosidagi haqiqiy dvigatel.
class WebRtcMeetingEngine implements MeetingMediaEngine {
  WebRtcMeetingEngine(this._repository);

  final CallRepository _repository;

  @override
  Future<Object?> openLocal({required bool video}) async {
    if (video) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          'audio': true,
          'video': {
            'facingMode': 'user',
            // Mesh: har bir ishtirokchiga alohida yuboriladi — o'rtacha sifat.
            'width': {'ideal': 640},
            'height': {'ideal': 360},
            'frameRate': {'ideal': 20},
          },
        });
      } on Object catch (e) {
        debugPrint('[meeting] camera unavailable, audio only: $e');
      }
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': false,
      });
    } on Object catch (e) {
      debugPrint('[meeting] getUserMedia error: $e');
      return null;
    }
  }

  @override
  bool hasVideo(Object local) =>
      (local as MediaStream).getVideoTracks().isNotEmpty;

  @override
  void setAudioEnabled(Object local, {required bool enabled}) {
    for (final t in (local as MediaStream).getAudioTracks()) {
      t.enabled = enabled;
    }
  }

  @override
  void setVideoEnabled(Object local, {required bool enabled}) {
    for (final t in (local as MediaStream).getVideoTracks()) {
      t.enabled = enabled;
    }
  }

  @override
  Future<void> switchCamera(Object local) async {
    final tracks = (local as MediaStream).getVideoTracks();
    if (tracks.isEmpty) return;
    await Helper.switchCamera(tracks.first);
  }

  @override
  Future<void> setSpeakerphone({required bool on}) async {
    try {
      await Helper.setSpeakerphoneOn(on);
    } on Object {
      // platformada yo'q — e'tiborsiz
    }
  }

  @override
  Future<List<Map<String, dynamic>>> iceServers() async {
    final result = await _repository.iceServers();
    final servers = result.fold((_) => kDefaultIceServers, (s) => s);
    return servers.isEmpty ? kDefaultIceServers : servers;
  }

  @override
  Future<MeetingPeer> createPeer({
    required Object local,
    required List<Map<String, dynamic>> iceServers,
  }) async {
    final pc = await createPeerConnection({
      'iceServers': iceServers,
      'sdpSemantics': 'unified-plan',
    });
    final peer = _WebRtcPeer(pc);
    final stream = local as MediaStream;
    for (final track in stream.getTracks()) {
      await pc.addTrack(track, stream);
    }
    return peer;
  }

  @override
  Future<void> disposeLocal(Object local) async {
    final stream = local as MediaStream;
    for (final t in stream.getTracks()) {
      await t.stop();
    }
    await stream.dispose();
  }
}

class _WebRtcPeer implements MeetingPeer {
  _WebRtcPeer(this._pc) {
    _pc
      ..onIceCandidate = (RTCIceCandidate c) {
        if (c.candidate == null) return;
        onIce?.call({
          'candidate': c.candidate,
          'sdpMid': c.sdpMid,
          'sdpMLineIndex': c.sdpMLineIndex,
        });
      }
      ..onTrack = (RTCTrackEvent e) {
        if (e.streams.isNotEmpty) onRemoteStream?.call(e.streams.first);
      }
      ..onConnectionState = (RTCPeerConnectionState s) {
        switch (s) {
          case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
            onConnection?.call(connected: true);
          case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
            // Mobil tarmoq almashuvi — ICE'ni qayta boshlab ko'ramiz.
            unawaited(_pc.restartIce().catchError((_) {}));
            onConnection?.call(connected: false);
          case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
            onConnection?.call(connected: false);
          case RTCPeerConnectionState.RTCPeerConnectionStateClosed:
          case RTCPeerConnectionState.RTCPeerConnectionStateNew:
          case RTCPeerConnectionState.RTCPeerConnectionStateConnecting:
            break;
        }
      };
  }

  final RTCPeerConnection _pc;

  @override
  void Function(Map<String, dynamic> candidate)? onIce;
  @override
  void Function(Object stream)? onRemoteStream;
  @override
  void Function({required bool connected})? onConnection;

  @override
  Future<Map<String, dynamic>> createOffer() async {
    final offer = await _pc.createOffer();
    await _pc.setLocalDescription(offer);
    return {'sdp': offer.sdp, 'type': offer.type};
  }

  @override
  Future<Map<String, dynamic>> createAnswer() async {
    final answer = await _pc.createAnswer();
    await _pc.setLocalDescription(answer);
    return {'sdp': answer.sdp, 'type': answer.type};
  }

  @override
  Future<void> setRemote(Map<String, dynamic> description) =>
      _pc.setRemoteDescription(
        RTCSessionDescription(
          description['sdp'] as String?,
          description['type'] as String?,
        ),
      );

  @override
  Future<void> addIce(Map<String, dynamic> candidate) => _pc.addCandidate(
    RTCIceCandidate(
      candidate['candidate'] as String?,
      candidate['sdpMid'] as String?,
      (candidate['sdpMLineIndex'] as num?)?.toInt(),
    ),
  );

  @override
  Future<void> setMaxVideoBitrate(int bps) async {
    try {
      for (final sender in await _pc.getSenders()) {
        if (sender.track?.kind != 'video') continue;
        final params = sender.parameters;
        final encodings = params.encodings;
        if (encodings == null || encodings.isEmpty) {
          params.encodings = [RTCRtpEncoding(maxBitrate: bps)];
        } else {
          encodings.first.maxBitrate = bps;
        }
        await sender.setParameters(params);
      }
    } on Object {
      // eski qurilmalar qo'llab-quvvatlamaydi — sifat avtomatik qoladi
    }
  }

  @override
  Future<void> close() => _pc.close();
}
