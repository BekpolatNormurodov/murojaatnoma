import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

import '../../support/fake_http.dart';

Position _at(DateTime time) => Position(
  latitude: 41.3,
  longitude: 69.3,
  timestamp: time,
  accuracy: 5,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
);

Future<List<String>> _outbox() async =>
    (await SharedPreferences.getInstance()).getStringList(
      LocationTrackingService.outboxKey,
    ) ??
    <String>[];

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('an offline walk is thinned to one point a minute', () async {
    final positions = StreamController<Position>();
    final service = LocationTrackingService(
      FakeHttp(offline).dio(),
      ownerId: () => 'A',
      ensurePermission: () async => true,
      positions: () => positions.stream,
      currentPosition: () => Completer<Position>().future,
    );
    await service.start();
    final start = DateTime.utc(2026, 11, 25, 5);
    // Ten minutes of walking, a fix every 10 seconds.
    for (var i = 0; i < 60; i++) {
      positions.add(_at(start.add(Duration(seconds: 10 * i))));
      await pumpEventQueue(times: 20);
    }
    final buffered = await _outbox();
    expect(buffered, hasLength(10));
    expect(
      (jsonDecode(buffered.last) as Map)['recordedAt'],
      '2026-11-25T05:09:00.000Z',
    );
    await service.stop();
    await positions.close();
  });

  test('the buffer holds more than a working day', () {
    expect(
      LocationTrackingService.offlineSpacing *
          LocationTrackingService.maxBuffer,
      greaterThan(const Duration(hours: 24)),
    );
  });

  test(
    'a long buffer is sent in chunks of at most 200, oldest first',
    () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(LocationTrackingService.outboxKey, [
        for (var i = 0; i < 450; i++)
          jsonEncode({'latitude': i, 'longitude': 69.3}),
      ]);
      final sizes = <int>[];
      final first = <Object?>[];
      final http = FakeHttp((o) {
        final items = (o.data as Map)['items'] as List;
        sizes.add(items.length);
        first.add((items.first as Map)['latitude']);
        return json({});
      });
      await LocationTrackingService(http.dio()).flush();
      expect(sizes.every((s) => s <= 200), isTrue);
      expect(sizes.fold<int>(0, (a, b) => a + b), 450);
      expect(first.first, 0);
      expect(await _outbox(), isEmpty);
    },
  );
}
