import 'dart:async';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';

/// Sinov uchun `Position` quruvchi — faqat `latitude`/`longitude` ahamiyatli,
/// qolgan maydonlar `AttendanceCubit`ning `attendance_cubit_test.dart`dagi
/// soxta pozitsiyasi bilan bir xil neytral qiymatlar. [accuracy] ixtiyoriy —
/// standart qiymati (5m) "yaxshi aniqlik"ni ifodalaydi; past aniqlik
/// filtrini sinash uchun kattaroq qiymat berish mumkin.
Position _positionAt(double lat, double lng, {double accuracy = 5}) =>
    Position(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime(2026, 7, 24, 9),
      accuracy: accuracy,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

/// Ish joyi markazi — geofence ichida.
final _insidePosition = _positionAt(kWorkplaceLat, kWorkplaceLng);

/// Markazdan ~50m siljigan ikkinchi nuqta (geofence radiusi — 150m —
/// ICHIDA): "iz tartibda to'planadi" testi uchun, ataylab geofence holatini
/// o'zgartirmaydigan darajada yaqin.
final _secondInsidePosition = _positionAt(
  kWorkplaceLat + 0.0005,
  kWorkplaceLng,
);

/// Markazdan bir necha kilometr uzoqlashgan nuqta — geofence radiusi (150m)
/// dan ANIQ TASHQARIDA.
final _outsidePosition = _positionAt(
  kWorkplaceLat + 0.05,
  kWorkplaceLng + 0.05,
);

const _firstTrailPoint = LatLng(kWorkplaceLat, kWorkplaceLng);
const _secondTrailPoint = LatLng(kWorkplaceLat + 0.0005, kWorkplaceLng);

void main() {
  group(MapCubit, () {
    late GeofenceService geofence;
    late StreamController<Position> controller;

    MapCubit buildCubit({
      Future<bool> Function()? ensurePermission,
      Future<bool> Function()? isPermanentlyDenied,
    }) {
      return MapCubit(
        geofence: geofence,
        positionStream: () => controller.stream,
        ensurePermission: ensurePermission ?? () async => true,
        // Default never reaches the real `Geolocator.checkPermission()`
        // (only consulted once `!granted`, and every test that denies
        // permission below supplies its own override) — kept `false` here
        // purely as a safe, plugin-free fallback.
        isPermanentlyDenied: isPermanentlyDenied ?? () async => false,
      );
    }

    setUp(() {
      geofence = GeofenceService();
      controller = StreamController<Position>();
    });

    // Fire-and-forget: a single-subscription `StreamController.close()`
    // future only completes once a listener has (at some point) been
    // attached — several tests below (permission-denied/seeded-tracking)
    // never call `MapCubit.start()` far enough to subscribe, so `await`ing
    // close() here would hang for the default test timeout. Closing is
    // still useful (marks the controller closed for any late `add` calls)
    // even though nothing awaits completion.
    tearDown(() => unawaited(controller.close()));

    test('initial state is MapInitial (map visible, not yet tracking)', () {
      expect(buildCubit().state, const MapInitial());
    });

    group('start', () {
      blocTest<MapCubit, MapState>(
        'permission denied/unavailable -> emits MapPermissionDenied '
        '(never uncaught)',
        build: () => buildCubit(ensurePermission: () async => false),
        act: (c) => c.start(),
        expect: () => [const MapLoading(), const MapPermissionDenied()],
      );

      blocTest<MapCubit, MapState>(
        'permission check throws -> emits MapPermissionDenied '
        '(never uncaught)',
        build: () => buildCubit(
          ensurePermission: () async => throw StateError('ruxsat xatosi'),
        ),
        act: (c) => c.start(),
        expect: () => [const MapLoading(), const MapPermissionDenied()],
      );

      blocTest<MapCubit, MapState>(
        'permanently denied -> emits MapPermissionDenied(permanentlyDenied: '
        'true) so the page can offer a settings shortcut',
        build: () => buildCubit(
          ensurePermission: () async => false,
          isPermanentlyDenied: () async => true,
        ),
        act: (c) => c.start(),
        expect: () => [
          const MapLoading(),
          const MapPermissionDenied(permanentlyDenied: true),
        ],
      );

      blocTest<MapCubit, MapState>(
        'permanently-denied check itself throws -> still emits a plain '
        'MapPermissionDenied (never uncaught, defaults to not-permanent)',
        build: () => buildCubit(
          ensurePermission: () async => false,
          isPermanentlyDenied: () async =>
              throw StateError("holatni aniqlab bo'lmadi"),
        ),
        act: (c) => c.start(),
        expect: () => [const MapLoading(), const MapPermissionDenied()],
      );

      blocTest<MapCubit, MapState>(
        'positions arrive in order -> breadcrumb trail accumulates in the '
        'same order',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          controller.add(_secondInsidePosition);
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>()
              .having((s) => s.position, 'position', _insidePosition)
              .having((s) => s.trail, 'trail', const [_firstTrailPoint]),
          isA<MapTracking>()
              .having((s) => s.position, 'position', _secondInsidePosition)
              .having((s) => s.trail, 'trail', const [
                _firstTrailPoint,
                _secondTrailPoint,
              ]),
        ],
      );

      blocTest<MapCubit, MapState>(
        'position inside the workplace radius -> insideGeofence true',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.insideGeofence,
            'insideGeofence',
            isTrue,
          ),
        ],
      );

      blocTest<MapCubit, MapState>(
        'position far from the workplace -> insideGeofence false',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_outsidePosition);
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.insideGeofence,
            'insideGeofence',
            isFalse,
          ),
        ],
      );

      blocTest<MapCubit, MapState>(
        'insideGeofence flips false -> true as the worker walks into the '
        'radius',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_outsidePosition);
          await Future<void>.delayed(Duration.zero);
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.insideGeofence,
            'insideGeofence',
            isFalse,
          ),
          isA<MapTracking>().having(
            (s) => s.insideGeofence,
            'insideGeofence',
            isTrue,
          ),
        ],
      );

      blocTest<MapCubit, MapState>(
        'stream error -> emits MapError (never uncaught)',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.addError(StateError('joylashuv oqimi uzildi'));
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapError>().having(
            (s) => s.message,
            'message',
            contains('joylashuv oqimi uzildi'),
          ),
        ],
      );

      blocTest<MapCubit, MapState>(
        'restarting clears the previous trail',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          await controller.close();
          controller = StreamController<Position>();
          await c.start();
          controller.add(_secondInsidePosition);
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_firstTrailPoint],
          ),
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_secondTrailPoint],
          ),
        ],
      );
    });

    group('stop', () {
      blocTest<MapCubit, MapState>(
        'cancels the subscription and freezes the last position/trail into '
        'MapStopped (NOT MapInitial -- the pin/trail must not vanish)',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          await c.stop();
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>(),
          isA<MapStopped>()
              .having((s) => s.position, 'position', _insidePosition)
              .having((s) => s.trail, 'trail', const [_firstTrailPoint])
              .having((s) => s.insideGeofence, 'insideGeofence', isTrue),
        ],
      );

      test(
        'positions emitted after stop() are no longer applied (never '
        'started tracking -> MapInitial, nothing to freeze)',
        () async {
          final cubit = buildCubit();
          await cubit.start();
          await cubit.stop();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          expect(cubit.state, const MapInitial());
          await cubit.close();
        },
      );

      test(
        'positions emitted on the OLD stream after stop() are ignored -- '
        'the frozen MapStopped trail/position never change',
        () async {
          final cubit = buildCubit();
          await cubit.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          await cubit.stop();
          final stoppedState = cubit.state;
          expect(stoppedState, isA<MapStopped>());

          // Obuna allaqachon bekor qilingan -- bu qo'shimcha nuqtalar HECH
          // QANDAY yangi holat emit qilmasligi kerak (marker/iz "muzlab"
          // qolgan bo'lishi kerak).
          controller.add(_secondInsidePosition);
          await Future<void>.delayed(Duration.zero);
          controller.add(_outsidePosition);
          await Future<void>.delayed(Duration.zero);

          expect(cubit.state, stoppedState);
          await cubit.close();
        },
      );

      blocTest<MapCubit, MapState>(
        'START after STOP resumes: re-subscribes to a fresh stream and '
        'starts a brand new trail (correct start/stop toggle)',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          await c.stop();
          await controller.close();
          // Haqiqiy qurilmada `positionStream()` qayta chaqirilganda yangi
          // platform-oqimiga ulanadi -- shu naqshni takrorlab, YANGI
          // controller bilan almashtiramiz.
          controller = StreamController<Position>();
          await c.start();
          controller.add(_secondInsidePosition);
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_firstTrailPoint],
          ),
          isA<MapStopped>(),
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_secondTrailPoint],
          ),
        ],
      );

      test(
        'double stop() is idempotent -- does NOT downgrade an existing '
        'MapStopped back to MapInitial (that would silently wipe the '
        'trail the user is still looking at)',
        () async {
          final cubit = buildCubit();
          await cubit.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          await cubit.stop();
          final stoppedState = cubit.state;
          expect(stoppedState, isA<MapStopped>());

          await cubit.stop();
          expect(cubit.state, stoppedState);
          await cubit.close();
        },
      );

      test(
        'stop() racing ahead of a still in-flight start() (slow permission '
        'check) wins -- the stale start() must NOT resurrect tracking once '
        'it finally resolves (use-after-cancel guard)',
        () async {
          final permissionCompleter = Completer<bool>();
          final cubit = buildCubit(
            ensurePermission: () => permissionCompleter.future,
          );

          final startFuture = cubit.start();
          // `start()` is now suspended awaiting permission; stop() races
          // ahead of it and "wins" first, well before permission resolves.
          await cubit.stop();
          expect(cubit.state, const MapInitial());

          // The slow permission check finally resolves -- AFTER stop()
          // already ran. The now-stale start() must recognise it has been
          // superseded and do nothing (no subscribe, no emit) -- otherwise
          // tracking would silently "come back to life" right after the
          // user tapped STOP.
          permissionCompleter.complete(true);
          await startFuture;
          await Future<void>.delayed(Duration.zero);
          expect(cubit.state, const MapInitial());

          // Proof it truly never subscribed: feeding the stream now must
          // NOT resurrect tracking.
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          expect(cubit.state, const MapInitial());

          await cubit.close();
        },
      );
    });

    group('trail filtering (GPS jitter)', () {
      // Haqiqiy >8m harakat qabul qilinishi allaqachon `start` guruhidagi
      // "positions arrive in order -> breadcrumb trail accumulates in the
      // same order" testida tekshirilgan (~55m siljish qabul qilinadi) --
      // shuning uchun bu yerda faqat UCHTA RAD ETISH yo'li alohida
      // tekshiriladi.
      blocTest<MapCubit, MapState>(
        'a low-accuracy fix (>30m) is skipped -- not appended to the '
        'trail, but the marker position still updates to it',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition); // accuracy 5 -> seeds the trail
          await Future<void>.delayed(Duration.zero);
          controller.add(
            _positionAt(kWorkplaceLat + 0.0005, kWorkplaceLng, accuracy: 50),
          );
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_firstTrailPoint],
          ),
          isA<MapTracking>()
              .having((s) => s.trail, 'trail', const [_firstTrailPoint])
              .having((s) => s.position.accuracy, 'position.accuracy', 50.0),
        ],
      );

      blocTest<MapCubit, MapState>(
        'a <8m jitter fix (good accuracy) is skipped -- kills stray '
        'zig-zags while standing still',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          // ~2.2m north of the last point -- comfortably under the 8m gate.
          controller.add(_positionAt(kWorkplaceLat + 0.00002, kWorkplaceLng));
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_firstTrailPoint],
          ),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_firstTrailPoint],
          ),
        ],
      );

      blocTest<MapCubit, MapState>(
        'an implausible >150m single-step jump is skipped as an outlier',
        build: buildCubit,
        act: (c) async {
          await c.start();
          controller.add(_insidePosition);
          await Future<void>.delayed(Duration.zero);
          // ~200m north -- not a plausible single step between live fixes.
          controller.add(_positionAt(kWorkplaceLat + 0.0018, kWorkplaceLng));
          await Future<void>.delayed(Duration.zero);
        },
        expect: () => [
          const MapLoading(),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_firstTrailPoint],
          ),
          isA<MapTracking>().having(
            (s) => s.trail,
            'trail',
            const [_firstTrailPoint],
          ),
        ],
      );
    });

    group('recenter', () {
      blocTest<MapCubit, MapState>(
        "already tracking -> no-op (camera move is the page's job, not a "
        'new state)',
        build: buildCubit,
        seed: () => MapTracking(
          position: _insidePosition,
          trail: const [_firstTrailPoint],
          insideGeofence: true,
        ),
        act: (c) => c.recenter(),
        expect: () => <MapState>[],
      );

      blocTest<MapCubit, MapState>(
        'not tracking -> behaves like start()',
        build: () => buildCubit(ensurePermission: () async => false),
        act: (c) => c.recenter(),
        expect: () => [const MapLoading(), const MapPermissionDenied()],
      );
    });

    test('close() never throws even mid-stream (cancels cleanly)', () async {
      final cubit = buildCubit();
      await cubit.start();
      controller.add(_insidePosition);
      await Future<void>.delayed(Duration.zero);
      await expectLater(cubit.close(), completes);
    });
  });
}
