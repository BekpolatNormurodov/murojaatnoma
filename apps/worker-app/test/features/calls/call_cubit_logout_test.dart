import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/core/notifications/notification_service.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';
import 'package:worker_app/features/calls/domain/repositories/call_repository.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';

class _Socket extends Mock implements RealtimeSocketService {}

class _Repository extends Mock implements CallRepository {}

class _Notifications extends Mock implements NotificationService {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('logout rejects a ringing call and returns to idle', () async {
    final socket = _Socket();
    final incoming = StreamController<Map<String, dynamic>>.broadcast();
    const none = Stream<Map<String, dynamic>>.empty();
    when(() => socket.callIncoming).thenAnswer((_) => incoming.stream);
    when(() => socket.callAccepted).thenAnswer((_) => none);
    when(() => socket.callRejected).thenAnswer((_) => none);
    when(() => socket.callCancelled).thenAnswer((_) => none);
    when(() => socket.callBusy).thenAnswer((_) => none);
    when(() => socket.callMissed).thenAnswer((_) => none);
    when(() => socket.callSdp).thenAnswer((_) => none);
    when(() => socket.callIce).thenAnswer((_) => none);
    when(() => socket.callEnded).thenAnswer((_) => none);
    final notifications = _Notifications();
    when(notifications.cancelIncomingCall).thenAnswer((_) async {});
    final cubit = CallCubit(
      socket: socket,
      repository: _Repository(),
      notifications: notifications,
    );
    addTearDown(incoming.close);

    incoming.add({'callId': 'c1', 'media': 'audio'});
    await pumpEventQueue();
    expect(cubit.state.phase, CallPhase.incoming);

    cubit.endSession();
    expect(cubit.state.phase, CallPhase.idle);
    verify(() => socket.rejectCall('c1')).called(1);
  });
}
