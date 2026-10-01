import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';
import 'package:worker_app/features/calls/data/meeting_media_engine.dart';

enum MeetingPhase { idle, incoming, joining, live, ended, error }

/// Yig'ilishdagi bitta (uzoq) ishtirokchi.
class MeetingMember extends Equatable {
  const MeetingMember({
    required this.id,
    required this.name,
    this.avatar,
    this.audio = true,
    this.video = true,
    this.connected = false,
    this.hasStream = false,
  });

  factory MeetingMember.fromJson(Map<String, dynamic> json) => MeetingMember(
    id: json['id'] as String,
    name: (json['name'] as String?) ?? 'Ishtirokchi',
    avatar: json['avatar'] as String?,
    audio: json['audio'] != false,
    video: json['video'] != false,
  );

  final String id;
  final String name;
  final String? avatar;
  final bool audio;
  final bool video;
  final bool connected;
  final bool hasStream;

  MeetingMember copyWith({
    bool? audio,
    bool? video,
    bool? connected,
    bool? hasStream,
  }) => MeetingMember(
    id: id,
    name: name,
    avatar: avatar,
    audio: audio ?? this.audio,
    video: video ?? this.video,
    connected: connected ?? this.connected,
    hasStream: hasStream ?? this.hasStream,
  );

  @override
  List<Object?> get props => [
    id,
    name,
    avatar,
    audio,
    video,
    connected,
    hasStream,
  ];
}

class MeetingState extends Equatable {
  const MeetingState({
    this.phase = MeetingPhase.idle,
    this.meetingId,
    this.title = '',
    this.hostName = '',
    this.video = true,
    this.members = const [],
    this.micOn = true,
    this.camOn = true,
    this.hasCamera = true,
    this.speakerOn = true,
    this.elapsed = Duration.zero,
    this.message,
  });

  final MeetingPhase phase;
  final String? meetingId;
  final String title;
  final String hostName;

  /// Video yig'ilishmi (ovozli bo'lsa kamera so'ralmaydi).
  final bool video;
  final List<MeetingMember> members;
  final bool micOn;
  final bool camOn;
  final bool hasCamera;
  final bool speakerOn;
  final Duration elapsed;

  /// Tugash/xato sababi ("Yig'ilish yakunlandi", ruxsat yo'q, ...).
  final String? message;

  MeetingState copyWith({
    MeetingPhase? phase,
    String? meetingId,
    String? title,
    String? hostName,
    bool? video,
    List<MeetingMember>? members,
    bool? micOn,
    bool? camOn,
    bool? hasCamera,
    bool? speakerOn,
    Duration? elapsed,
    String? message,
  }) => MeetingState(
    phase: phase ?? this.phase,
    meetingId: meetingId ?? this.meetingId,
    title: title ?? this.title,
    hostName: hostName ?? this.hostName,
    video: video ?? this.video,
    members: members ?? this.members,
    micOn: micOn ?? this.micOn,
    camOn: camOn ?? this.camOn,
    hasCamera: hasCamera ?? this.hasCamera,
    speakerOn: speakerOn ?? this.speakerOn,
    elapsed: elapsed ?? this.elapsed,
    message: message ?? this.message,
  );

  @override
  List<Object?> get props => [
    phase,
    meetingId,
    title,
    hostName,
    video,
    members,
    micOn,
    camOn,
    hasCamera,
    speakerOn,
    elapsed,
    message,
  ];
}

/// Bitta uzoq peer uchun ichki holat (React'dagi PeerEntry analogi).
class _Slot {
  _Slot(this.peer);
  final MeetingPeer peer;
  bool remoteSet = false;
  final List<Map<String, dynamic>> pendingIce = [];
  Object? stream;
}

/// GLOBAL guruh qo'ng'irog'i (yig'ilish, Zoom kabi) boshqaruvchisi — mesh
/// WebRTC: har bir ishtirokchi bilan alohida ulanish.
///
/// Konvensiya (web-admin `MeetingCall` bilan bir xil): YANGI kelgan
/// ishtirokchi xonadagi har biriga OFFER yuboradi; keyin kelganlar bizga
/// offer qiladi, biz answer qaytaramiz. ICE remote tavsifgacha navbatda.
class MeetingCubit extends Cubit<MeetingState> {
  MeetingCubit({
    required RealtimeSocketService socket,
    required MeetingMediaEngine engine,
  }) : _socket = socket,
       _engine = engine,
       super(const MeetingState()) {
    _subs
      ..add(_socket.meetingIncoming.listen(_onIncoming))
      ..add(_socket.meetingJoined.listen(_onJoined))
      ..add(_socket.meetingLeft.listen(_onLeft))
      ..add(_socket.meetingSdp.listen((e) => unawaited(_onSdp(e))))
      ..add(_socket.meetingIce.listen((e) => unawaited(_onIce(e))))
      ..add(_socket.meetingMedia.listen(_onMedia))
      ..add(_socket.meetingEnded.listen(_onEnded));
    _readySub = _socket.onReady.listen((_) => unawaited(checkActive()));
  }

  final RealtimeSocketService _socket;
  final MeetingMediaEngine _engine;
  final List<StreamSubscription<Map<String, dynamic>>> _subs = [];
  StreamSubscription<void>? _readySub;

  final Map<String, _Slot> _slots = {};

  /// Peer yaratilmasdan (offer'dan oldin) kelgan ICE — keyin qo'shiladi.
  final Map<String, List<Map<String, dynamic>>> _earlyIce = {};

  /// Bir peer uchun parallel yaratilishning oldini olish.
  final Map<String, Future<_Slot>> _creating = {};

  /// "Rad etish" bosilgan yig'ilishlar — qayta taklif oynasi chiqmaydi.
  final Set<String> _declined = {};

  List<Map<String, dynamic>> _iceServers = const [];
  Object? _local;
  Timer? _ticker;
  DateTime? _startedAt;

  /// Lokal (o'zim) oqim — UI `RTCVideoRenderer`ga ulaydi.
  Object? get localStream => _local;

  /// Ishtirokchining uzoq oqimi (hali kelmagan bo'lsa `null`).
  Object? streamOf(String memberId) => _slots[memberId]?.stream;

  bool get _inMeeting =>
      state.phase == MeetingPhase.joining || state.phase == MeetingPhase.live;

  // ---- Ommaviy amallar ----

  /// Ilova ochilganda/qayta ulanganda: taklif qilingan jonli yig'ilish bo'lsa —
  /// taklif oynasini ko'rsatadi (push bosib kirilganda ham shu ishlaydi).
  Future<void> checkActive() async {
    if (state.phase != MeetingPhase.idle) return;
    final list = await _socket.activeMeetings();
    if (state.phase != MeetingPhase.idle) return;
    for (final m in list) {
      final id = m['meetingId'] as String?;
      if (id == null || _declined.contains(id)) continue;
      emit(
        MeetingState(
          phase: MeetingPhase.incoming,
          meetingId: id,
          title: (m['title'] as String?) ?? "Guruh qo'ng'irog'i",
          hostName: (m['hostName'] as String?) ?? "Ma'muriyat",
          video: m['media'] != 'audio',
        ),
      );
      return;
    }
  }

  /// Taklifni qabul qilish (taklif oynasidan).
  Future<void> accept() async {
    final id = state.meetingId;
    if (state.phase != MeetingPhase.incoming || id == null) return;
    await join(
      meetingId: id,
      title: state.title,
      video: state.video,
      hostName: state.hostName,
    );
  }

  /// Taklifni rad etish — tashkilotchi ko'radi; shu yig'ilish qayta chiqmaydi.
  void decline() {
    final id = state.meetingId;
    if (state.phase != MeetingPhase.incoming || id == null) return;
    _declined.add(id);
    _socket.declineMeeting(id);
    emit(const MeetingState());
  }

  /// Yig'ilishga qo'shiladi (chatdagi "Qo'shilish" yoki taklif orqali).
  Future<void> join({
    required String meetingId,
    required String title,
    bool video = true,
    String hostName = '',
  }) async {
    if (_inMeeting) {
      if (state.meetingId == meetingId) return;
      leave(); // boshqa yig'ilishdan chiqib, yangisiga
    }
    emit(
      MeetingState(
        phase: MeetingPhase.joining,
        meetingId: meetingId,
        title: title,
        hostName: hostName,
        video: video,
      ),
    );

    final local = await _engine.openLocal(video: video);
    if (local == null) {
      _fail('Mikrofonga ruxsat berilmadi');
      return;
    }
    if (state.meetingId != meetingId || state.phase != MeetingPhase.joining) {
      await _engine.disposeLocal(local);
      return;
    }
    _local = local;
    final hasCamera = _engine.hasVideo(local);
    unawaited(_engine.setSpeakerphone(on: true));
    _iceServers = await _engine.iceServers();

    final ack = await _socket.joinMeeting(
      meetingId: meetingId,
      audio: true,
      video: hasCamera,
    );
    if (state.meetingId != meetingId || state.phase != MeetingPhase.joining) {
      return;
    }
    if (ack == null) {
      _fail("Ulanib bo'lmadi — internetni tekshiring");
      return;
    }
    if (ack['ok'] == false) {
      _fail(
        ack['error'] == 'not-invited'
            ? "Bu yig'ilish allaqachon tugagan"
            : "Yig'ilishga qo'shilib bo'lmadi",
      );
      return;
    }

    final existing = [
      for (final p in (ack['participants'] as List? ?? const []))
        if (p is Map && p['id'] is String)
          MeetingMember.fromJson(Map<String, dynamic>.from(p)),
    ];
    final info = ack['meeting'];
    _startedAt = DateTime.now();
    emit(
      state.copyWith(
        phase: MeetingPhase.live,
        members: existing,
        hasCamera: hasCamera,
        camOn: hasCamera,
        title: info is Map && info['title'] is String
            ? info['title'] as String
            : null,
      ),
    );
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      final start = _startedAt;
      if (start != null && state.phase == MeetingPhase.live) {
        emit(state.copyWith(elapsed: DateTime.now().difference(start)));
      }
    });
    // Mesh: men yangi keldim — xonadagi har biriga offer.
    for (final m in existing) {
      unawaited(_offerTo(m.id));
    }
  }

  void toggleMic() {
    final local = _local;
    if (local == null) return;
    final on = !state.micOn;
    _engine.setAudioEnabled(local, enabled: on);
    emit(state.copyWith(micOn: on));
    _sendMedia();
  }

  void toggleCam() {
    final local = _local;
    if (local == null || !state.hasCamera) return;
    final on = !state.camOn;
    _engine.setVideoEnabled(local, enabled: on);
    emit(state.copyWith(camOn: on));
    _sendMedia();
  }

  Future<void> switchCamera() async {
    final local = _local;
    if (local == null || !state.hasCamera) return;
    try {
      await _engine.switchCamera(local);
    } on Object catch (e) {
      debugPrint('[meeting] switchCamera: $e');
    }
  }

  Future<void> toggleSpeaker() async {
    final on = !state.speakerOn;
    await _engine.setSpeakerphone(on: on);
    emit(state.copyWith(speakerOn: on));
  }

  /// O'zim chiqaman (yig'ilish boshqalar uchun davom etadi).
  void leave() {
    final id = state.meetingId;
    if (id != null && _inMeeting) _socket.leaveMeeting(id);
    _teardown();
    emit(
      state.copyWith(
        phase: MeetingPhase.ended,
        message: "Siz yig'ilishdan chiqdingiz",
      ),
    );
  }

  /// Tugash ekranidan keyin — keyingi yig'ilishga tayyor.
  void reset() {
    if (state.phase == MeetingPhase.ended ||
        state.phase == MeetingPhase.error) {
      emit(const MeetingState());
    }
  }

  // ---- Socket hodisalari ----

  void _onIncoming(Map<String, dynamic> e) {
    final id = e['meetingId'] as String?;
    if (id == null || _declined.contains(id)) return;
    // Faol yig'ilish/taklif paytida yangisi jim o'tadi (chatda baribir ko'rinadi).
    if (state.phase != MeetingPhase.idle) return;
    final host = e['host'];
    emit(
      MeetingState(
        phase: MeetingPhase.incoming,
        meetingId: id,
        title: (e['title'] as String?) ?? "Guruh qo'ng'irog'i",
        hostName: host is Map ? (host['name'] as String?) ?? '' : '',
        video: e['media'] != 'audio',
      ),
    );
  }

  void _onJoined(Map<String, dynamic> e) {
    if (e['meetingId'] != state.meetingId || !_inMeeting) return;
    final raw = e['participant'];
    if (raw is! Map || raw['id'] is! String) return;
    final member = MeetingMember.fromJson(Map<String, dynamic>.from(raw));
    final others = state.members.where((m) => m.id != member.id);
    emit(state.copyWith(members: [...others, member]));
    // U bizga offer qiladi — peer'ni oldindan tayyorlaymiz.
    unawaited(_ensure(member.id));
  }

  void _onLeft(Map<String, dynamic> e) {
    if (e['meetingId'] != state.meetingId) return;
    final id = e['userId'] as String?;
    if (id == null) return;
    _closeSlot(id);
    emit(
      state.copyWith(members: state.members.where((m) => m.id != id).toList()),
    );
    unawaited(_rebalanceBitrate());
  }

  Future<void> _onSdp(Map<String, dynamic> e) async {
    if (e['meetingId'] != state.meetingId || !_inMeeting) return;
    final from = e['fromUserId'] as String?;
    final raw = e['description'];
    if (from == null || raw is! Map) return;
    final desc = Map<String, dynamic>.from(raw);
    try {
      if (desc['type'] == 'offer') {
        final slot = await _ensure(from);
        await slot.peer.setRemote(desc);
        slot.remoteSet = true;
        await _flush(slot);
        final answer = await slot.peer.createAnswer();
        _socket.sendMeetingSdp(
          meetingId: state.meetingId!,
          toUserId: from,
          description: answer,
        );
      } else if (desc['type'] == 'answer') {
        final slot = _slots[from];
        if (slot == null) return;
        await slot.peer.setRemote(desc);
        slot.remoteSet = true;
        await _flush(slot);
      }
    } on Object catch (err) {
      debugPrint('[meeting] sdp from $from: $err');
    }
  }

  Future<void> _onIce(Map<String, dynamic> e) async {
    if (e['meetingId'] != state.meetingId || !_inMeeting) return;
    final from = e['fromUserId'] as String?;
    final raw = e['candidate'];
    if (from == null || raw is! Map) return;
    final candidate = Map<String, dynamic>.from(raw);
    final slot = _slots[from];
    if (slot == null) {
      (_earlyIce[from] ??= []).add(candidate);
      return;
    }
    if (!slot.remoteSet) {
      slot.pendingIce.add(candidate);
      return;
    }
    try {
      await slot.peer.addIce(candidate);
    } on Object catch (err) {
      debugPrint('[meeting] addIce: $err');
    }
  }

  void _onMedia(Map<String, dynamic> e) {
    if (e['meetingId'] != state.meetingId) return;
    final id = e['userId'] as String?;
    emit(
      state.copyWith(
        members: state.members
            .map(
              (m) => m.id == id
                  ? m.copyWith(
                      audio: e['audio'] != false,
                      video: e['video'] != false,
                    )
                  : m,
            )
            .toList(),
      ),
    );
  }

  void _onEnded(Map<String, dynamic> e) {
    final id = e['meetingId'] as String?;
    if (id == null || id != state.meetingId) return;
    if (state.phase == MeetingPhase.incoming) {
      emit(const MeetingState()); // taklif bekor bo'ldi
      return;
    }
    if (!_inMeeting) return;
    _teardown();
    emit(
      state.copyWith(
        phase: MeetingPhase.ended,
        message: "Yig'ilish yakunlandi",
      ),
    );
  }

  // ---- WebRTC ----

  Future<_Slot> _ensure(String id) {
    final existing = _slots[id];
    if (existing != null) return Future.value(existing);
    // NB: the callback must return void — returning `_creating.remove(id)`
    // (this very future) made whenComplete wait on itself: a deadlock.
    return _creating[id] ??= _create(id).whenComplete(() {
      _creating.remove(id);
    });
  }

  Future<_Slot> _create(String id) async {
    final local = _local!;
    final peer = await _engine.createPeer(
      local: local,
      iceServers: _iceServers,
    );
    final slot = _Slot(peer);
    final meetingId = state.meetingId;
    peer
      ..onIce = (candidate) {
        if (meetingId == null) return;
        _socket.sendMeetingIce(
          meetingId: meetingId,
          toUserId: id,
          candidate: candidate,
        );
      }
      ..onRemoteStream = (stream) {
        slot.stream = stream;
        _patch(id, (m) => m.copyWith(hasStream: true));
      }
      ..onConnection = ({required connected}) {
        _patch(id, (m) => m.copyWith(connected: connected));
      };
    _slots[id] = slot;
    final early = _earlyIce.remove(id);
    if (early != null) slot.pendingIce.addAll(early);
    unawaited(_rebalanceBitrate());
    return slot;
  }

  Future<void> _offerTo(String id) async {
    try {
      final slot = await _ensure(id);
      final offer = await slot.peer.createOffer();
      final meetingId = state.meetingId;
      if (meetingId == null || !_inMeeting) return;
      _socket.sendMeetingSdp(
        meetingId: meetingId,
        toUserId: id,
        description: offer,
      );
    } on Object catch (err) {
      debugPrint('[meeting] offer to $id: $err');
    }
  }

  Future<void> _flush(_Slot slot) async {
    final list = List<Map<String, dynamic>>.from(slot.pendingIce);
    slot.pendingIce.clear();
    for (final c in list) {
      try {
        await slot.peer.addIce(c);
      } on Object {
        // yaroqsiz nomzod — o'tkazamiz
      }
    }
  }

  /// Mesh: odam ko'paygani sari har bir chiquvchi video yengillashadi.
  Future<void> _rebalanceBitrate() async {
    final people = _slots.length + 1;
    final bps = people <= 2
        ? 1000000
        : people <= 4
        ? 500000
        : people <= 6
        ? 300000
        : 180000;
    // Copy: peers may be added/removed while we await (concurrent joins).
    for (final slot in _slots.values.toList()) {
      try {
        await slot.peer.setMaxVideoBitrate(bps);
      } on Object {
        // closed meanwhile — fine
      }
    }
  }

  void _patch(String id, MeetingMember Function(MeetingMember) f) {
    if (!_inMeeting) return;
    emit(
      state.copyWith(
        members: state.members.map((m) => m.id == id ? f(m) : m).toList(),
      ),
    );
  }

  void _sendMedia() {
    final id = state.meetingId;
    if (id == null || !_inMeeting) return;
    _socket.sendMeetingMedia(
      meetingId: id,
      audio: state.micOn,
      video: state.hasCamera && state.camOn,
    );
  }

  void _closeSlot(String id) {
    final slot = _slots.remove(id);
    _earlyIce.remove(id);
    if (slot != null) unawaited(slot.peer.close());
  }

  void _fail(String message) {
    _teardown();
    emit(state.copyWith(phase: MeetingPhase.error, message: message));
  }

  void _teardown() {
    _ticker?.cancel();
    _ticker = null;
    _startedAt = null;
    for (final id in _slots.keys.toList()) {
      _closeSlot(id);
    }
    _earlyIce.clear();
    final local = _local;
    _local = null;
    if (local != null) unawaited(_engine.disposeLocal(local));
  }

  @override
  Future<void> close() {
    for (final s in _subs) {
      unawaited(s.cancel());
    }
    unawaited(_readySub?.cancel());
    _teardown();
    return super.close();
  }
}
