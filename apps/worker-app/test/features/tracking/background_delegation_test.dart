import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/tracking/background_tracking.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

import '../../support/fake_http.dart';

class _Host implements BackgroundTracking {
  _Host({this.works = true});

  bool works;
  final List<String> started = [];
  int stopped = 0;

  @override
  Future<bool> start(String ownerId) async {
    started.add(ownerId);
    return works;
  }

  @override
  Future<void> stop() async => stopped++;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  var streams = 0;

  LocationTrackingService service(_Host host, {bool granted = true}) {
    streams = 0;
    return LocationTrackingService(
      FakeHttp((_) => json({})).dio(),
      ownerId: () => 'A',
      ensurePermission: () async => granted,
      hasPermission: () async => granted,
      positions: () {
        streams++;
        return const Stream<Position>.empty();
      },
      currentPosition: () => Completer<Position>().future,
      background: host,
    );
  }

  test('the background service tracks instead of an in-app stream', () async {
    final host = _Host();
    final tracking = service(host);

    expect(await tracking.start(), isTrue);
    expect(tracking.status.value, TrackingStatus.running);
    expect(host.started, ['A']);
    expect(streams, 0);

    // Every resume makes sure the service is still alive.
    await tracking.start(prompt: false);
    expect(host.started, ['A', 'A']);

    await tracking.stop();
    expect(host.stopped, 1);
    expect(tracking.isRunning, isFalse);
  });

  test('a service that cannot start falls back to in-app tracking', () async {
    final tracking = service(_Host(works: false));
    addTearDown(tracking.stop);

    expect(await tracking.start(), isTrue);
    expect(streams, 1);
  });

  test('a later start moves in-app tracking to the service', () async {
    final host = _Host(works: false);
    final tracking = service(host);
    await tracking.start();

    host.works = true;
    await tracking.start(prompt: false);

    expect(host.started, ['A', 'A']);
    expect(tracking.status.value, TrackingStatus.running);
    await tracking.stop();
    expect(streams, 1);
  });

  test('without permission the service is not started', () async {
    final host = _Host();
    final tracking = service(host, granted: false);

    expect(await tracking.start(), isFalse);
    expect(tracking.status.value, TrackingStatus.blocked);
    expect(host.started, isEmpty);
  });

  test('a stream that fell silent is opened again', () {
    fakeAsync((async) {
      var opened = 0;
      final tracking = LocationTrackingService(
        FakeHttp((_) => json({})).dio(),
        ensurePermission: () async => true,
        positions: () {
          opened++;
          // `Stream.empty` bekor qilinishi soxta vaqtda tugamaydi.
          return StreamController<Position>(onCancel: () async {}).stream;
        },
        currentPosition: () => Completer<Position>().future,
        silentStreamAfter: Duration.zero,
      );
      unawaited(tracking.start());
      async.elapse(const Duration(seconds: 31));
      expect(opened, 2);
      unawaited(tracking.stop());
      async.flushMicrotasks();
    });
  });
}
