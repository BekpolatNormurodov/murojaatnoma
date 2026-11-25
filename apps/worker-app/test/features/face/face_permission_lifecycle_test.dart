import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/face/data/services/face_detector_service.dart';
import 'package:worker_app/features/face/data/services/face_embedder.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';
import 'package:worker_app/features/face/domain/usecases/enroll_face.dart';
import 'package:worker_app/features/face/domain/usecases/verify_face.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';

class _Detector extends Mock implements FaceDetectorService {}

class _Embedder extends Mock implements FaceEmbedder {}

class _Enroll extends Mock implements EnrollFace {}

class _Verify extends Mock implements VerifyFace {}

class _CheckIn extends Mock implements CheckIn {}

class _CheckOut extends Mock implements CheckOut {}

class _Geofence extends Mock implements GeofenceService {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter.baseflow.com/permissions/methods');
  late List<String> calls;
  late FaceCubit cubit;
  // Ochiq turgan ruxsat dialogi: tugatilguncha `request` javob bermaydi.
  late Completer<void> dialog;

  setUp(() {
    calls = [];
    dialog = Completer<void>()..complete();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          calls.add(call.method);
          // 0 == denied.
          if (call.method == 'requestPermissions') {
            await dialog.future;
            return {for (final p in call.arguments as List) p: 0};
          }
          return 0;
        });
    final detector = _Detector();
    when(detector.dispose).thenAnswer((_) async {});
    cubit = FaceCubit(
      detector: detector,
      embedder: _Embedder(),
      enrollFace: _Enroll(),
      verifyFace: _Verify(),
      checkIn: _CheckIn(),
      checkOut: _CheckOut(),
      geofence: _Geofence(),
      workerId: 'w',
    );
  });

  tearDown(() async {
    if (!cubit.isClosed) await cubit.close();
  });

  int requests() => calls.where((c) => c == 'requestPermissions').length;

  test('resume during the permission dialog does not start twice', () async {
    dialog = Completer<void>();
    final first = cubit.startCamera();
    await cubit.resumeCamera();
    final second = cubit.startCamera();
    dialog.complete();
    await Future.wait([first, second]);

    expect(requests(), 1);
    expect(cubit.state, isA<FacePermissionDenied>());
  });

  test('resume after a denial only checks, never re-prompts', () async {
    await cubit.startCamera();
    await cubit.resumeCamera();

    expect(requests(), 1);
    expect(calls, contains('checkPermissionStatus'));
  });

  test('closing mid-start does not emit on a closed cubit', () async {
    final start = cubit.startCamera();
    await cubit.close();

    await expectLater(start, completes);
  });
}
