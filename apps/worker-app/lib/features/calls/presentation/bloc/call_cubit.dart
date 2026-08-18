import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';
import 'package:worker_app/features/calls/data/datasources/call_remote_data_source.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';
import 'package:worker_app/features/calls/domain/repositories/call_repository.dart';

part 'call_state.dart';

/// GLOBAL 1:1 WebRTC qo'ng'iroq boshqaruvchisi (ilova ildizida BITTA
/// instansiya, `app.dart`da `BlocProvider` orqali). Kontrakt:
/// `docs/superpowers/specs/2026-08-18-realtime-chat-calls-contract.md`.
///
/// Vazifasi:
///  - socketning `call:*` server->client oqimlarini tinglaydi (kiruvchi
///    qo'ng'iroq, accept/reject/cancel/busy/missed/ended, SDP, ICE);
///  - BITTA [RTCPeerConnection]ni boshqaradi — offer/answer + trickle-ICE
///    aynan kontrakt oqimi bo'yicha (chaqiruvchi `call:accepted`da offer
///    yasaydi; chaqirilgan answer beradi);
///  - `getUserMedia` orqali mahalliy media oladi, `RTCVideoRenderer`larni
///    (lokal + remote) to'ldiradi;
///  - tugaganda TO'LIQ tozalaydi (treklar to'xtaydi, PC yopiladi) —
///    kamera hech qachon "osilib" qolmaydi.
///
/// Faol qo'ng'iroq davomida IKKINCHI qo'ng'iroqqa yo'l qo'yilmaydi
/// (kiruvchi ikkinchi chaqiruv avtomatik rad etiladi; chiquvchi urinish
/// e'tiborsiz qoldiriladi).
class CallCubit extends Cubit<CallState> {
  CallCubit({
    required RealtimeSocketService socket,
    required CallRepository repository,
  }) : _socket = socket,
       _repository = repository,
       super(const CallState.idle()) {
    _subscribe();
  }

  final RealtimeSocketService _socket;
  final CallRepository _repository;

  final RTCVideoRenderer localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer remoteRenderer = RTCVideoRenderer();
  bool _renderersReady = false;

  RTCPeerConnection? _pc;
  MediaStream? _localStream;

  final List<StreamSubscription<Map<String, dynamic>>> _subs = [];

  /// SDP `setRemoteDescription` bajarilgunga qadar kelgan ICE nomzodlari —
  /// remote tavsif o'rnatilgach yuboriladi (aks holda `addCandidate` xato).
  final List<RTCIceCandidate> _pendingRemoteCandidates = [];
  bool _remoteDescriptionSet = false;

  Timer? _elapsedTimer;
  DateTime? _connectedAt;

  /// Faol qo'ng'iroq bormi (2-qo'ng'iroq qo'riqchisi uchun).
  bool get _busy =>
      state.phase == CallPhase.outgoing ||
      state.phase == CallPhase.incoming ||
      state.phase == CallPhase.connecting ||
      state.phase == CallPhase.active;

  // ---- Socket obunalari ----

  void _subscribe() {
    _subs
      ..add(_socket.callIncoming.listen(_onIncoming))
      ..add(_socket.callAccepted.listen(_onAccepted))
      ..add(_socket.callRejected.listen(_onRejected))
      ..add(_socket.callCancelled.listen(_onCancelled))
      ..add(_socket.callBusy.listen(_onBusy))
      ..add(_socket.callMissed.listen(_onMissed))
      ..add(_socket.callSdp.listen(_onSdp))
      ..add(_socket.callIce.listen(_onIce))
      ..add(_socket.callEnded.listen(_onEnded));
  }

  // ---- Ommaviy amallar (UI/FCM chaqiradi) ----

  /// Chiquvchi qo'ng'iroq boshlaydi (xodim -> admin `toUserId:'me'`, yoki
  /// boshqa xodim). Faol qo'ng'iroq bo'lsa e'tiborsiz qoldiriladi.
  Future<void> startCall({
    required String toUserId,
    required String toName,
    required CallMedia media,
    String? toAvatar,
  }) async {
    if (_busy) return;
    emit(
      CallState(
        phase: CallPhase.outgoing,
        peer: CallPeer(id: toUserId, name: toName, avatar: toAvatar),
        direction: CallDirection.outgoing,
        media: media,
        camOn: media == CallMedia.video,
      ),
    );

    final mediaReady = await _openLocalMedia(media);
    if (!mediaReady) return; // _fail allaqachon holatni tugatgan.

    await _createPeerConnection();
    await _addLocalTracks();

    final callId = await _socket.inviteCall(
      toUserId: toUserId,
      media: media.wire,
    );
    if (callId == null) {
      _fail("Qo'ng'iroqni boshlab bo'lmadi");
      return;
    }
    if (state.phase != CallPhase.outgoing) return; // oradanto tugadi.
    emit(state.copyWith(callId: callId));
  }

  /// Kiruvchi qo'ng'iroqni qabul qiladi (jiringlash ekranidan). Chaqiruvchi
  /// `call:accepted`ni olib offer yasaydi; biz answer beramiz.
  Future<void> accept() async {
    if (state.phase != CallPhase.incoming) return;
    final callId = state.callId;
    if (callId == null) return;

    final mediaReady = await _openLocalMedia(state.media);
    if (!mediaReady) {
      // Ruxsat berilmasa — chaqiruvchiga rad javobi va tozalash.
      _socket.rejectCall(callId);
      return;
    }

    await _createPeerConnection();
    await _addLocalTracks();
    _socket.acceptCall(callId);
    emit(state.copyWith(phase: CallPhase.connecting));
  }

  /// FCM to'liq-ekran bildirishnomasi bosilganda (`incoming_call` push) —
  /// socketni ulaydi (idempotent) va qo'ng'iroqni qabul qiladi. `call:accept`
  /// emit `presence:snapshot` (auth tayyor) kutadi, shuning uchun socket
  /// hali autentifikatsiya qilinayotgan bo'lsa ham xavfsiz.
  Future<void> acceptFromPush({
    required String callId,
    required String callerName,
    required CallMedia media,
  }) async {
    if (_busy) return;
    unawaited(_socket.connect());
    emit(
      CallState(
        phase: CallPhase.incoming,
        callId: callId,
        peer: CallPeer(id: '', name: callerName),
        media: media,
        camOn: media == CallMedia.video,
      ),
    );
    await accept();
  }

  /// Kiruvchi qo'ng'iroqni rad etadi.
  void reject() {
    final callId = state.callId;
    if (callId != null) _socket.rejectCall(callId);
    _finish(CallEndReason.rejected);
  }

  /// Chiquvchi qo'ng'iroqni javobdan oldin bekor qiladi.
  void cancel() {
    final callId = state.callId;
    if (callId != null) _socket.cancelCall(callId);
    _finish(CallEndReason.cancelled);
  }

  /// Faol (yoki ulanayotgan) qo'ng'iroqni tugatadi (go'shakni qo'yish).
  void hangUp() {
    final callId = state.callId;
    if (callId != null) _socket.endCall(callId);
    _finish(CallEndReason.hangup);
  }

  /// Mikrofonni yoqadi/o'chiradi.
  void toggleMic() {
    final on = !state.micOn;
    for (final track
        in _localStream?.getAudioTracks() ?? const <MediaStreamTrack>[]) {
      track.enabled = on;
    }
    emit(state.copyWith(micOn: on));
  }

  /// Kamerani yoqadi/o'chiradi (video qo'ng'iroqda).
  void toggleCam() {
    final on = !state.camOn;
    for (final track
        in _localStream?.getVideoTracks() ?? const <MediaStreamTrack>[]) {
      track.enabled = on;
    }
    emit(state.copyWith(camOn: on));
  }

  /// Old/orqa kamerani almashtiradi.
  Future<void> switchCamera() async {
    final tracks =
        _localStream?.getVideoTracks() ?? const <MediaStreamTrack>[];
    if (tracks.isEmpty) return;
    try {
      await Helper.switchCamera(tracks.first);
      emit(state.copyWith(frontCamera: !state.frontCamera));
    } on Object catch (e) {
      debugPrint('[call] switchCamera error: $e');
    }
  }

  // ---- Socket eventlari (server -> client) ----

  void _onIncoming(Map<String, dynamic> event) {
    final callId = event['callId'] as String?;
    if (callId == null) return;

    // 2-qo'ng'iroq qo'riqchisi: allaqachon band bo'lsa avtomatik rad.
    if (_busy) {
      _socket.rejectCall(callId);
      return;
    }

    final rawFrom = event['from'];
    final peer = rawFrom is Map
        ? CallPeer.fromJson(Map<String, dynamic>.from(rawFrom))
        : const CallPeer(id: '', name: 'Nomaʼlum');
    emit(
      CallState(
        phase: CallPhase.incoming,
        callId: callId,
        peer: peer,
        media: CallMedia.fromWire(event['media'] as String?),
        camOn: CallMedia.fromWire(event['media'] as String?) == CallMedia.video,
      ),
    );
  }

  /// Chaqiruvchi: qo'ng'iroq qabul qilindi -> offer yasab yuboradi.
  Future<void> _onAccepted(Map<String, dynamic> event) async {
    final callId = state.callId;
    if (callId == null || event['callId'] != callId) return;
    if (state.direction != CallDirection.outgoing) return;
    final pc = _pc;
    if (pc == null) return;
    emit(state.copyWith(phase: CallPhase.connecting));
    try {
      final offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      _socket.sendSdp(
        callId: callId,
        description: {'sdp': offer.sdp, 'type': offer.type},
      );
    } on Object catch (e) {
      debugPrint('[call] createOffer error: $e');
      _fail('Ulanishda xatolik');
    }
  }

  /// SDP keldi — offer (biz answer beramiz) yoki answer (biz o'rnatamiz).
  Future<void> _onSdp(Map<String, dynamic> event) async {
    final callId = state.callId;
    if (callId == null || event['callId'] != callId) return;
    final raw = event['description'];
    if (raw is! Map) return;
    final sdp = raw['sdp'] as String?;
    final type = raw['type'] as String?;
    final pc = _pc;
    if (pc == null || sdp == null || type == null) return;

    try {
      await pc.setRemoteDescription(RTCSessionDescription(sdp, type));
      _remoteDescriptionSet = true;
      await _flushPendingCandidates();

      if (type == 'offer') {
        // Chaqirilgan tomon: answer yasab yuboradi.
        final answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        _socket.sendSdp(
          callId: callId,
          description: {'sdp': answer.sdp, 'type': answer.type},
        );
      }
    } on Object catch (e) {
      debugPrint('[call] onSdp error: $e');
      _fail('Ulanishda xatolik');
    }
  }

  /// ICE nomzodi keldi — remote tavsif tayyor bo'lsa qo'shadi, aks holda
  /// buferlaydi.
  Future<void> _onIce(Map<String, dynamic> event) async {
    if (event['callId'] != state.callId) return;
    final raw = event['candidate'];
    if (raw is! Map) return;
    final candidate = RTCIceCandidate(
      raw['candidate'] as String?,
      raw['sdpMid'] as String?,
      (raw['sdpMLineIndex'] as num?)?.toInt(),
    );
    if (_pc == null) return;
    if (_remoteDescriptionSet) {
      try {
        await _pc!.addCandidate(candidate);
      } on Object catch (e) {
        debugPrint('[call] addCandidate error: $e');
      }
    } else {
      _pendingRemoteCandidates.add(candidate);
    }
  }

  void _onRejected(Map<String, dynamic> event) {
    if (event['callId'] != state.callId) return;
    _finish(CallEndReason.rejected);
  }

  void _onCancelled(Map<String, dynamic> event) {
    if (event['callId'] != state.callId) return;
    _finish(CallEndReason.cancelled);
  }

  void _onBusy(Map<String, dynamic> event) {
    if (event['callId'] != state.callId) return;
    _finish(CallEndReason.busy);
  }

  void _onMissed(Map<String, dynamic> event) {
    if (event['callId'] != state.callId) return;
    _finish(CallEndReason.missed);
  }

  void _onEnded(Map<String, dynamic> event) {
    if (event['callId'] != state.callId) return;
    _finish(CallEndReason.remoteEnded);
  }

  // ---- WebRTC yordamchilari ----

  Future<void> _ensureRenderers() async {
    if (_renderersReady) return;
    await localRenderer.initialize();
    await remoteRenderer.initialize();
    _renderersReady = true;
  }

  /// `getUserMedia` orqali mahalliy media oladi va lokal rendererni
  /// to'ldiradi. Ruxsat berilmasa/xatolik bo'lsa `false` qaytaradi va
  /// holatni [CallEndReason.failed] bilan tugatadi.
  Future<bool> _openLocalMedia(CallMedia media) async {
    try {
      await _ensureRenderers();
      final constraints = <String, dynamic>{
        'audio': true,
        'video': media == CallMedia.video
            ? {'facingMode': 'user'}
            : false,
      };
      final stream = await navigator.mediaDevices.getUserMedia(constraints);
      _localStream = stream;
      localRenderer.srcObject = stream;
      return true;
    } on Object catch (e) {
      debugPrint('[call] getUserMedia error: $e');
      _fail('Kamera/mikrofonga ruxsat berilmadi');
      return false;
    }
  }

  Future<void> _createPeerConnection() async {
    final config = await _iceConfig();
    final pc = await createPeerConnection(config);

    pc
      ..onIceCandidate = (RTCIceCandidate candidate) {
        final callId = state.callId;
        if (candidate.candidate == null || callId == null) return;
        _socket.sendIce(
          callId: callId,
          candidate: {
            'candidate': candidate.candidate,
            'sdpMid': candidate.sdpMid,
            'sdpMLineIndex': candidate.sdpMLineIndex,
          },
        );
      }
      ..onTrack = (RTCTrackEvent event) {
        if (event.streams.isNotEmpty) {
          remoteRenderer.srcObject = event.streams.first;
          if (!state.remoteVideoReady) {
            emit(state.copyWith(remoteVideoReady: true));
          }
        }
      }
      ..onConnectionState = (RTCPeerConnectionState connState) {
        switch (connState) {
          case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
            _markActive();
          case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
            _fail('Ulanish uzildi');
          case RTCPeerConnectionState.RTCPeerConnectionStateClosed:
          case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
          case RTCPeerConnectionState.RTCPeerConnectionStateNew:
          case RTCPeerConnectionState.RTCPeerConnectionStateConnecting:
            break;
        }
      };

    _pc = pc;
  }

  Future<void> _addLocalTracks() async {
    final stream = _localStream;
    final pc = _pc;
    if (stream == null || pc == null) return;
    for (final track in stream.getTracks()) {
      await pc.addTrack(track, stream);
    }
  }

  Future<Map<String, dynamic>> _iceConfig() async {
    final result = await _repository.iceServers();
    final servers = result.fold((_) => kDefaultIceServers, (s) => s);
    return {
      'iceServers': servers.isEmpty ? kDefaultIceServers : servers,
      'sdpSemantics': 'unified-plan',
    };
  }

  Future<void> _flushPendingCandidates() async {
    if (_pendingRemoteCandidates.isEmpty) return;
    final pending = List<RTCIceCandidate>.from(_pendingRemoteCandidates);
    _pendingRemoteCandidates.clear();
    for (final candidate in pending) {
      try {
        await _pc?.addCandidate(candidate);
      } on Object catch (e) {
        debugPrint('[call] flush addCandidate error: $e');
      }
    }
  }

  void _markActive() {
    if (state.phase == CallPhase.active) return;
    _connectedAt = DateTime.now();
    emit(state.copyWith(phase: CallPhase.active));
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      final start = _connectedAt;
      if (start == null) return;
      emit(state.copyWith(elapsed: DateTime.now().difference(start)));
    });
  }

  // ---- Tugatish / tozalash ----

  /// Media/ulanish xatosi — holatni [CallEndReason.failed] bilan tugatadi.
  void _fail(String message) {
    _teardownMedia();
    emit(
      CallState(
        phase: CallPhase.ended,
        peer: state.peer,
        media: state.media,
        direction: state.direction,
        endReason: CallEndReason.failed,
        errorMessage: message,
      ),
    );
  }

  /// Qo'ng'iroqni [reason] bilan tugatadi va mediani tozalaydi.
  void _finish(CallEndReason reason) {
    if (state.phase == CallPhase.idle || state.phase == CallPhase.ended) {
      _teardownMedia();
      return;
    }
    final elapsed = state.elapsed;
    _teardownMedia();
    emit(
      CallState(
        phase: CallPhase.ended,
        peer: state.peer,
        media: state.media,
        direction: state.direction,
        elapsed: elapsed,
        endReason: reason,
      ),
    );
  }

  /// UI tugash ekranini ko'rsatgach chaqiradi — holatni [CallPhase.idle]ga
  /// qaytaradi (keyingi qo'ng'iroqqa tayyor).
  void reset() {
    if (state.phase == CallPhase.ended) {
      emit(const CallState.idle());
    }
  }

  /// TREKLAR to'xtaydi, PC yopiladi, rendererlar bo'shatiladi — kamera
  /// hech qachon "osilib" qolmaydi.
  void _teardownMedia() {
    _elapsedTimer?.cancel();
    _elapsedTimer = null;
    _connectedAt = null;
    _remoteDescriptionSet = false;
    _pendingRemoteCandidates.clear();

    final stream = _localStream;
    _localStream = null;
    if (stream != null) {
      for (final track in stream.getTracks()) {
        unawaited(track.stop());
      }
      unawaited(stream.dispose());
    }
    localRenderer.srcObject = null;
    remoteRenderer.srcObject = null;

    final pc = _pc;
    _pc = null;
    if (pc != null) {
      unawaited(pc.close());
    }
  }

  @override
  Future<void> close() {
    for (final sub in _subs) {
      unawaited(sub.cancel());
    }
    _teardownMedia();
    if (_renderersReady) {
      unawaited(localRenderer.dispose());
      unawaited(remoteRenderer.dispose());
    }
    return super.close();
  }
}
