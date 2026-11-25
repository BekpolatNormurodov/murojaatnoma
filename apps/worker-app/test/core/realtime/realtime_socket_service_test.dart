import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a rejected socket token triggers one session refresh', () async {
    var refreshes = 0;
    final socket = RealtimeSocketService(
      await SharedPreferences.getInstance(),
      refreshSession: () async => refreshes++,
    );
    await socket.handleServerRejection();
    // `auth:error` and "io server disconnect" arrive together.
    await socket.handleServerRejection();
    expect(refreshes, 1);
    expect(socket.isConnected, isFalse);
    socket.disconnect(); // cancels the pending reconnect
  });

  test('an invite that never gets ready times out', () async {
    final socket = RealtimeSocketService(await SharedPreferences.getInstance());
    final callId = await socket.inviteCall(
      toUserId: 'x',
      media: 'audio',
      timeout: const Duration(milliseconds: 10),
    );
    expect(callId, isNull);
  });
}
