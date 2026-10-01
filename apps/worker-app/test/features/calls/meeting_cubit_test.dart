import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';
import 'package:worker_app/features/calls/data/meeting_media_engine.dart';
import 'package:worker_app/features/calls/presentation/bloc/meeting_cubit.dart';

/// Socket fake: server→client streams we can push into + a log of emits.
class FakeSocket implements RealtimeSocketService {
  final incoming = StreamController<Map<String, dynamic>>.broadcast();
  final joined = StreamController<Map<String, dynamic>>.broadcast();
  final left = StreamController<Map<String, dynamic>>.broadcast();
  final sdp = StreamController<Map<String, dynamic>>.broadcast();
  final ice = StreamController<Map<String, dynamic>>.broadcast();
  final media = StreamController<Map<String, dynamic>>.broadcast();
  final ended = StreamController<Map<String, dynamic>>.broadcast();
  final ready = StreamController<void>.broadcast();

  Map<String, dynamic>? joinAck = {'ok': true, 'participants': <dynamic>[]};
  List<Map<String, dynamic>> active = const [];
  final sentSdp = <Map<String, dynamic>>[];
  final sentIce = <Map<String, dynamic>>[];
  final sentMedia = <Map<String, dynamic>>[];
  final declined = <String>[];
  final leftMeetings = <String>[];

  @override
  Stream<Map<String, dynamic>> get meetingIncoming => incoming.stream;
  @override
  Stream<Map<String, dynamic>> get meetingJoined => joined.stream;
  @override
  Stream<Map<String, dynamic>> get meetingLeft => left.stream;
  @override
  Stream<Map<String, dynamic>> get meetingSdp => sdp.stream;
  @override
  Stream<Map<String, dynamic>> get meetingIce => ice.stream;
  @override
  Stream<Map<String, dynamic>> get meetingMedia => media.stream;
  @override
  Stream<Map<String, dynamic>> get meetingEnded => ended.stream;
  @override
  Stream<void> get onReady => ready.stream;

  @override
  Future<Map<String, dynamic>?> joinMeeting({
    required String meetingId,
    required bool audio,
    required bool video,
  }) async => joinAck;

  @override
  Future<List<Map<String, dynamic>>> activeMeetings() async => active;

  @override
  void declineMeeting(String meetingId) => declined.add(meetingId);

  @override
  void leaveMeeting(String meetingId) => leftMeetings.add(meetingId);

  @override
  void sendMeetingSdp({
    required String meetingId,
    required String toUserId,
    required Map<String, dynamic> description,
  }) => sentSdp.add({'to': toUserId, ...description});

  @override
  void sendMeetingIce({
    required String meetingId,
    required String toUserId,
    required Map<String, dynamic> candidate,
  }) => sentIce.add({'to': toUserId, ...candidate});

  @override
  void sendMeetingMedia({
    required String meetingId,
    required bool audio,
    required bool video,
  }) => sentMedia.add({'audio': audio, 'video': video});

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakePeer implements MeetingPeer {
  FakePeer(this.id);
  final String id;
  final remote = <Map<String, dynamic>>[];
  final addedIce = <Map<String, dynamic>>[];
  final bitrates = <int>[];
  bool closed = false;

  @override
  void Function(Map<String, dynamic> candidate)? onIce;
  @override
  void Function(Object stream)? onRemoteStream;
  @override
  void Function({required bool connected})? onConnection;

  @override
  Future<Map<String, dynamic>> createOffer() async => {'type': 'offer', 'sdp': 'o-$id'};
  @override
  Future<Map<String, dynamic>> createAnswer() async {
    if (remote.isEmpty) throw StateError('answer before remote offer');
    return {'type': 'answer', 'sdp': 'a-$id'};
  }

  @override
  Future<void> setRemote(Map<String, dynamic> description) async => remote.add(description);
  @override
  Future<void> addIce(Map<String, dynamic> candidate) async {
    if (remote.isEmpty) throw StateError('ICE before remote description');
    addedIce.add(candidate);
  }

  @override
  Future<void> setMaxVideoBitrate(int bps) async => bitrates.add(bps);
  @override
  Future<void> close() async => closed = true;
}

class FakeEngine implements MeetingMediaEngine {
  bool micAllowed = true;
  bool camera = true;
  bool disposed = false;
  final peers = <FakePeer>[];
  final audio = <bool>[];

  @override
  Future<Object?> openLocal({required bool video}) async =>
      micAllowed ? 'local-stream' : null;
  @override
  bool hasVideo(Object local) => camera;
  @override
  void setAudioEnabled(Object local, {required bool enabled}) => audio.add(enabled);
  @override
  void setVideoEnabled(Object local, {required bool enabled}) {}
  @override
  Future<void> switchCamera(Object local) async {}
  @override
  Future<void> setSpeakerphone({required bool on}) async {}
  @override
  Future<List<Map<String, dynamic>>> iceServers() async => const [];
  @override
  Future<MeetingPeer> createPeer({
    required Object local,
    required List<Map<String, dynamic>> iceServers,
  }) async {
    final p = FakePeer('p${peers.length}');
    peers.add(p);
    return p;
  }

  @override
  Future<void> disposeLocal(Object local) async => disposed = true;
}

Future<void> pump() => Future<void>.delayed(Duration.zero);

void main() {
  late FakeSocket socket;
  late FakeEngine engine;
  late MeetingCubit cubit;

  setUp(() {
    socket = FakeSocket();
    engine = FakeEngine();
    cubit = MeetingCubit(socket: socket, engine: engine);
  });
  tearDown(() => cubit.close());

  Map<String, dynamic> invite(String id) => {
    'meetingId': id,
    'title': 'Selektor',
    'media': 'video',
    'host': {'id': 'admin:1', 'name': 'Hokim'},
  };

  test('invite rings; decline tells the host and never re-rings that meeting', () async {
    socket.incoming.add(invite('m1'));
    await pump();
    expect(cubit.state.phase, MeetingPhase.incoming);
    expect(cubit.state.hostName, 'Hokim');

    cubit.decline();
    expect(socket.declined, ['m1']);
    expect(cubit.state.phase, MeetingPhase.idle);

    socket.incoming.add(invite('m1'));
    await pump();
    expect(cubit.state.phase, MeetingPhase.idle);
  });

  test('joining a room offers to everyone already inside (mesh)', () async {
    socket.joinAck = {
      'ok': true,
      'participants': [
        {'id': 'admin:1', 'name': 'Hokim'},
        {'id': 'e2', 'name': 'Ali', 'video': false},
      ],
    };
    await cubit.join(meetingId: 'm1', title: 'Selektor');
    await pump();

    expect(cubit.state.phase, MeetingPhase.live);
    expect(cubit.state.members.map((m) => m.id), ['admin:1', 'e2']);
    expect(cubit.state.members.last.video, isFalse);
    expect(socket.sentSdp.map((s) => '${s['to']}:${s['type']}'), ['admin:1:offer', 'e2:offer']);
    // 3 people → lighter video than a 1:1
    expect(engine.peers.first.bitrates.last, lessThan(1000000));
  });

  test('late joiner: early ICE is held until their offer, then answered', () async {
    await cubit.join(meetingId: 'm1', title: 'Selektor');
    socket.ice.add({'meetingId': 'm1', 'fromUserId': 'e3', 'candidate': {'candidate': 'c1'}});
    await pump();
    socket.joined.add({'meetingId': 'm1', 'participant': {'id': 'e3', 'name': 'Vali'}});
    await pump();
    expect(cubit.state.members.single.name, 'Vali');

    socket.sdp.add({'meetingId': 'm1', 'fromUserId': 'e3', 'description': {'type': 'offer', 'sdp': 'x'}});
    await pump();
    await pump();
    final peer = engine.peers.single;
    expect(peer.remote.single['type'], 'offer');
    expect(peer.addedIce.single['candidate'], 'c1');
    expect(socket.sentSdp.single, containsPair('type', 'answer'));
    expect(socket.sentSdp.single['to'], 'e3');
  });

  test("answers and ICE are routed to the right peer; others' traffic ignored", () async {
    socket.joinAck = {
      'ok': true,
      'participants': [
        {'id': 'a', 'name': 'A'},
        {'id': 'b', 'name': 'B'},
      ],
    };
    await cubit.join(meetingId: 'm1', title: 'T');
    await pump();
    socket.ice.add({'meetingId': 'm1', 'fromUserId': 'b', 'candidate': {'candidate': 'cb'}});
    socket.sdp.add({'meetingId': 'm1', 'fromUserId': 'b', 'description': {'type': 'answer', 'sdp': 'y'}});
    socket.sdp.add({'meetingId': 'other', 'fromUserId': 'a', 'description': {'type': 'answer', 'sdp': 'z'}});
    await pump();
    await pump();
    final a = engine.peers[0], b = engine.peers[1];
    expect(a.remote, isEmpty);
    expect(b.remote.single['type'], 'answer');
    expect(b.addedIce.single['candidate'], 'cb');
  });

  test('media / leave / stream events update the tiles', () async {
    socket.joinAck = {
      'ok': true,
      'participants': [
        {'id': 'a', 'name': 'A'},
      ],
    };
    await cubit.join(meetingId: 'm1', title: 'T');
    await pump();
    engine.peers.single.onRemoteStream?.call('remote-a');
    engine.peers.single.onConnection?.call(connected: true);
    expect(cubit.state.members.single.hasStream, isTrue);
    expect(cubit.state.members.single.connected, isTrue);
    expect(cubit.streamOf('a'), 'remote-a');

    socket.media.add({'meetingId': 'm1', 'userId': 'a', 'audio': false, 'video': true});
    await pump();
    expect(cubit.state.members.single.audio, isFalse);

    socket.left.add({'meetingId': 'm1', 'userId': 'a'});
    await pump();
    expect(cubit.state.members, isEmpty);
    expect(engine.peers.single.closed, isTrue);
  });

  test('mic toggle is signalled; leaving frees media and tells the server', () async {
    await cubit.join(meetingId: 'm1', title: 'T');
    cubit.toggleMic();
    expect(engine.audio.last, isFalse);
    expect(socket.sentMedia.last, {'audio': false, 'video': true});

    cubit.leave();
    expect(socket.leftMeetings, ['m1']);
    expect(engine.disposed, isTrue);
    expect(cubit.state.phase, MeetingPhase.ended);
    cubit.reset();
    expect(cubit.state.phase, MeetingPhase.idle);
  });

  test('host ends the meeting → ended, everything released', () async {
    socket.joinAck = {
      'ok': true,
      'participants': [
        {'id': 'a', 'name': 'A'},
      ],
    };
    await cubit.join(meetingId: 'm1', title: 'T');
    await pump();
    socket.ended.add({'meetingId': 'm1', 'durationSec': 30});
    await pump();
    expect(cubit.state.phase, MeetingPhase.ended);
    expect(cubit.state.message, contains('yakunlandi'));
    expect(engine.peers.single.closed, isTrue);
    expect(engine.disposed, isTrue);
  });

  test('a pending invite disappears when the meeting ends before answering', () async {
    socket.incoming.add(invite('m9'));
    await pump();
    socket.ended.add({'meetingId': 'm9'});
    await pump();
    expect(cubit.state.phase, MeetingPhase.idle);
  });

  test('ended / not invited / no microphone → clear error, nothing left open', () async {
    socket.joinAck = {'ok': false, 'error': 'not-invited'};
    await cubit.join(meetingId: 'old', title: 'T');
    expect(cubit.state.phase, MeetingPhase.error);
    expect(cubit.state.message, contains('tugagan'));
    expect(engine.disposed, isTrue);

    cubit.reset();
    engine
      ..micAllowed = false
      ..disposed = false;
    await cubit.join(meetingId: 'm2', title: 'T');
    expect(cubit.state.phase, MeetingPhase.error);
    expect(cubit.state.message, contains('Mikrofon'));
  });

  test('no camera → joins audio-only and says so to the room', () async {
    engine.camera = false;
    await cubit.join(meetingId: 'm1', title: 'T');
    expect(cubit.state.hasCamera, isFalse);
    cubit.toggleMic();
    expect(socket.sentMedia.last, {'audio': false, 'video': false});
  });

  test('on (re)connect a live meeting I was invited to shows up (push tap path)', () async {
    socket.active = [
      {'meetingId': 'mX', 'title': 'Kechki selektor', 'hostName': 'Hokim', 'media': 'audio'},
    ];
    socket.ready.add(null);
    await pump();
    await pump();
    expect(cubit.state.phase, MeetingPhase.incoming);
    expect(cubit.state.title, 'Kechki selektor');
    expect(cubit.state.video, isFalse);
  });
}
