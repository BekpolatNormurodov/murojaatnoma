import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';

void main() {
  test('returning to the app never re-opens the permission prompt', () async {
    var prompts = 0;
    var granted = false;
    final cubit = MapCubit(
      geofence: GeofenceService(),
      positionStream: () => const Stream<Position>.empty(),
      ensurePermission: () async {
        prompts++;
        return granted;
      },
      isPermanentlyDenied: () async => false,
      hasPermission: () async => granted,
    );
    addTearDown(cubit.close);
    await cubit.start();
    expect(cubit.state, isA<MapPermissionDenied>());
    expect(prompts, 1);

    // The denied dialog closing delivers "resumed".
    await cubit.resumeIfPermitted();
    expect(prompts, 1);
    expect(cubit.state, isA<MapPermissionDenied>());

    // Granted in Settings: the map recovers by itself.
    granted = true;
    await cubit.resumeIfPermitted();
    expect(cubit.state, isA<MapLoading>());
    expect(prompts, 2);
  });
}
