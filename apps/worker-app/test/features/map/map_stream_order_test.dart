import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';

void main() {
  test('server tracking opens the shared GPS stream before the map', () async {
    final order = <String>[];
    final cubit = MapCubit(
      geofence: GeofenceService(),
      ensurePermission: () async => true,
      beforeSubscribe: () async => order.add('tracking'),
      positionStream: () {
        order.add('map');
        return const Stream<Position>.empty();
      },
      currentPosition: null,
    );
    addTearDown(cubit.close);
    await cubit.start();
    expect(order, ['tracking', 'map']);
  });

  test(
    'a dead GPS stream is released so a restart opens a fresh one',
    () async {
      var cancelled = 0;
      final source = StreamController<Position>(onCancel: () => cancelled++);
      final cubit = MapCubit(
        geofence: GeofenceService(),
        ensurePermission: () async => true,
        positionStream: () => source.stream,
        currentPosition: null,
      );
      addTearDown(cubit.close);
      await cubit.start();
      source.addError(const LocationServiceDisabledException());
      await pumpEventQueue();
      expect(cubit.state, isA<MapError>());
      expect(cancelled, 1);
    },
  );
}
