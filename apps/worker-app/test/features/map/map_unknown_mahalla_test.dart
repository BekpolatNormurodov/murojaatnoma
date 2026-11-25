import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';
import 'package:worker_app/features/map/presentation/pages/map_page.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

import '../../support/fake_http.dart';

class _Client implements DioClient {
  _Client(this.dio);

  @override
  Dio dio;
}

void main() {
  testWidgets('without loaded boundaries the map never claims "outside the '
      'district"', (tester) async {
    await getIt.reset();
    addTearDown(getIt.reset);
    final dio = FakeHttp((_) => json({'message': 'offline'}, 500)).dio();
    getIt
      ..registerSingleton<DioClient>(_Client(dio))
      ..registerSingleton<LocationTrackingService>(
        LocationTrackingService(dio, ensurePermission: () async => false),
      );
    final cubit = MapCubit(
      geofence: GeofenceService(),
      ensurePermission: () async => true,
      positionStream: () => Stream<Position>.value(
        Position(
          latitude: 41.31,
          longitude: 69.34,
          timestamp: DateTime(2026, 11, 25, 12),
          accuracy: 8,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        ),
      ),
      currentPosition: null,
    );
    addTearDown(cubit.close);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider<MapCubit>.value(
          value: cubit,
          child: const Scaffold(body: MapPage()),
        ),
      ),
    );
    await cubit.start();
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 300));
    }
    expect(cubit.state, isA<MapTracking>());
    expect(find.text('Tuman tashqarisida'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(minutes: 6));
  });
}
