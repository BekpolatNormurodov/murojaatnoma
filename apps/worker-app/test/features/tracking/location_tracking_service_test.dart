import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

import '../../support/fake_http.dart';

Position _position([double lat = 41.3]) => Position(
  latitude: lat,
  longitude: 69.3,
  timestamp: DateTime(2026, 11, 25, 10),
  accuracy: 5,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
);

Future<List<Map<String, dynamic>>> _outbox() async {
  final prefs = await SharedPreferences.getInstance();
  return [
    for (final raw
        in prefs.getStringList(LocationTrackingService.outboxKey) ?? <String>[])
      jsonDecode(raw) as Map<String, dynamic>,
  ];
}

String _entry(double lat, [String? owner]) => jsonEncode({
  'latitude': lat,
  'longitude': 69.3,
  if (owner != null) '_owner': owner,
});

List<dynamic> _items(RequestOptions o) =>
    (o.data as Map<String, dynamic>)['items'] as List<dynamic>;

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> seed(List<String> entries) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(LocationTrackingService.outboxKey, entries);
  }

  test(
    "only the signed-in employee's points are sent; others are kept",
    () async {
      await seed([_entry(1, 'A'), _entry(2, 'B')]);
      String? owner = 'B';
      final http = FakeHttp((_) => json({}));
      final service = LocationTrackingService(http.dio(), ownerId: () => owner);

      await service.flush();
      expect(_items(http.requests.single), [
        {'latitude': 2, 'longitude': 69.3},
      ]);
      expect((await _outbox()).single['_owner'], 'A');

      // Logged out: nothing leaves the device.
      owner = null;
      await service.flush();
      expect(http.requests, hasLength(1));

      owner = 'A';
      await service.flush();
      expect(await _outbox(), isEmpty);
    },
  );

  test('start(prompt: false) only checks the permission, never asks', () async {
    var asked = 0;
    var checked = 0;
    var granted = false;
    final service = LocationTrackingService(
      FakeHttp((_) => json({})).dio(),
      ensurePermission: () async {
        asked++;
        return false;
      },
      hasPermission: () async {
        checked++;
        return granted;
      },
      positions: () => const Stream<Position>.empty(),
      currentPosition: () async => _position(),
    );
    addTearDown(service.stop);

    expect(await service.start(prompt: false), isFalse);
    expect(service.status.value, TrackingStatus.blocked);
    expect((asked, checked), (0, 1));

    // Permission granted in Settings: the next resume starts tracking.
    granted = true;
    expect(await service.start(prompt: false), isTrue);
    expect(service.status.value, TrackingStatus.running);
    expect(asked, 0);
  });

  test('claimOutbox tags legacy points with the current employee', () async {
    await seed([_entry(1)]);
    final service = LocationTrackingService(
      FakeHttp((_) => json({})).dio(),
      ownerId: () => 'A',
    );
    await service.claimOutbox();
    expect((await _outbox()).single['_owner'], 'A');
  });

  test('points queued while a batch is in flight are not lost', () async {
    await seed([_entry(1, 'A')]);
    final gate = Completer<void>();
    var online = true;
    final http = FakeHttp((o) async {
      if (o.path.contains('batch')) {
        if (!gate.isCompleted) await gate.future;
        return online ? json({}) : offline(o);
      }
      return offline(o);
    });
    final positions = StreamController<Position>();
    final service = LocationTrackingService(
      http.dio(),
      ownerId: () => 'A',
      ensurePermission: () async => true,
      positions: () => positions.stream,
      currentPosition: () => Completer<Position>().future,
    );
    await service.start();
    final flushing = service.flush();
    final second = service.flush(); // shares the in-flight upload
    await pumpEventQueue();
    positions.add(_position(7)); // fails -> queued during the batch
    await pumpEventQueue(times: 50);
    online = true;
    gate.complete();
    await Future.wait([flushing, second]);

    final batches = http.requests.where((r) => r.path.contains('batch'));
    final sent = [for (final b in batches) ..._items(b)];
    expect(
      sent.where((i) => (i as Map)['latitude'] == 1),
      hasLength(1),
      reason: 'no duplicates',
    );
    expect(sent.where((i) => (i as Map)['latitude'] == 7), hasLength(1));
    expect(await _outbox(), isEmpty);
    await service.stop();
    await positions.close();
  });

  test(
    'a point the server rejects is dropped without blocking the rest',
    () async {
      await seed([_entry(1, 'A'), _entry(999, 'A'), _entry(3, 'A')]);
      final accepted = <dynamic>[];
      final http = FakeHttp((o) {
        final items = _items(o);
        if (items.any((i) => (i as Map)['latitude'] == 999)) {
          return json({'message': 'bad'}, 400);
        }
        accepted.addAll(items.map((i) => (i as Map)['latitude']));
        return json({});
      });
      await LocationTrackingService(http.dio(), ownerId: () => 'A').flush();
      expect(accepted, [1, 3]);
      expect(await _outbox(), isEmpty);
    },
  );

  test('server errors keep the buffer for later', () async {
    await seed([_entry(1, 'A')]);
    final http = FakeHttp((_) => json({}, 503));
    await LocationTrackingService(http.dio(), ownerId: () => 'A').flush();
    expect(await _outbox(), hasLength(1));
  });

  test('permission granted later starts tracking', () async {
    var granted = false;
    final service = LocationTrackingService(
      FakeHttp((_) => json({})).dio(),
      ensurePermission: () async => granted,
      positions: () => const Stream<Position>.empty(),
      currentPosition: () async => _position(),
    );
    expect(await service.start(), isFalse);
    expect(service.status.value, TrackingStatus.blocked);
    granted = true;
    expect(await service.start(), isTrue);
    expect(service.status.value, TrackingStatus.running);
    await service.stop();
  });

  test('stop() during a pending permission check stays stopped', () async {
    final permission = Completer<bool>();
    final service = LocationTrackingService(
      FakeHttp((_) => json({})).dio(),
      ensurePermission: () => permission.future,
      positions: () => const Stream<Position>.empty(),
      currentPosition: () async => _position(),
    );
    final starting = service.start();
    await service.stop();
    permission.complete(true);
    expect(await starting, isFalse);
    expect(service.isRunning, isFalse);
  });
}
