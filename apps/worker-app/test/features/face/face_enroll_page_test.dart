import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';
import 'package:worker_app/features/face/data/services/face_detector_service.dart';
import 'package:worker_app/features/face/data/services/face_embedder.dart';
import 'package:worker_app/features/face/domain/usecases/enroll_face.dart';
import 'package:worker_app/features/face/domain/usecases/verify_face.dart';
import 'package:worker_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:worker_app/features/face/presentation/pages/face_enroll_page.dart';

class _MockFaceDetectorService extends Mock implements FaceDetectorService {}

class _MockFaceEmbedder extends Mock implements FaceEmbedder {}

class _MockEnrollFace extends Mock implements EnrollFace {}

class _MockVerifyFace extends Mock implements VerifyFace {}

class _MockCheckIn extends Mock implements CheckIn {}

class _MockCheckOut extends Mock implements CheckOut {}

class _MockGeofenceService extends Mock implements GeofenceService {}

/// `FaceCubit.startCamera()` haqiqiy kamera/ruxsat/model plaginlarini
/// chaqiradi — widget testida (VM, platform kanalisiz) bular mavjud
/// emas. Bu soxta pastki klass uni berilgan holatni to'g'ridan-to'g'ri
/// `emit` qiladigan qilib almashtiradi, shunda sahifa istalgan
/// `FaceState` bilan deterministik render qilinadi.
class _FixedStateFaceCubit extends FaceCubit {
  _FixedStateFaceCubit(
    this._fixedState, {
    required super.detector,
    required super.embedder,
    required super.enrollFace,
    required super.verifyFace,
    required super.checkIn,
    required super.checkOut,
    required super.geofence,
    super.workerId = 'W-1042',
  });

  final FaceState _fixedState;

  @override
  Future<void> startCamera() async => emit(_fixedState);
}

void main() {
  late FaceDetectorService detector;
  late FaceEmbedder embedder;
  late EnrollFace enrollFace;
  late VerifyFace verifyFace;
  late CheckIn checkIn;
  late CheckOut checkOut;
  late GeofenceService geofence;

  setUp(() {
    detector = _MockFaceDetectorService();
    embedder = _MockFaceEmbedder();
    enrollFace = _MockEnrollFace();
    verifyFace = _MockVerifyFace();
    checkIn = _MockCheckIn();
    checkOut = _MockCheckOut();
    geofence = _MockGeofenceService();
    when(() => detector.dispose()).thenAnswer((_) async {});
  });

  Future<void> pumpWithState(WidgetTester tester, FaceState state) async {
    final cubit = _FixedStateFaceCubit(
      state,
      detector: detector,
      embedder: embedder,
      enrollFace: enrollFace,
      verifyFace: verifyFace,
      checkIn: checkIn,
      checkOut: checkOut,
      geofence: geofence,
    );
    addTearDown(cubit.close);

    // `_TopBar` sahifa ichida `context.canPop()` (GoRouter) chaqiradi —
    // shuning uchun oddiy `MaterialApp(home: ...)` emas, haqiqiy
    // (bitta-marshrutli) `GoRouter` bilan `MaterialApp.router` kerak.
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, _) => BlocProvider<FaceCubit>.value(
            value: cubit,
            child: const FaceEnrollPage(),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp.router(
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    );
    // `pumpAndSettle()` emas: jonli-gate holatlari (masalan `searching`)
    // `app_ui`dagi `FaceScanOverlay` ichida cheksiz takrorlanuvchi
    // "nafas olish" VA skaner-chiziq animatsiyalarini ishlatadi, shuning
    // uchun hech qachon "settle" bo'lmaydi. Buning o'rniga soatni bitta
    // pump'da yetarlicha oldinga suramiz — shu bilan `flutter_animate`ning
    // chekli (bir martalik) taymerlari to'liq tugaydi, cheksiz Ticker'lar
    // esa faqat bitta freym oladi (`pumpAndSettle` kabi cheksiz
    // sikllanmaydi).
    await tester.pump(const Duration(seconds: 2));
  }

  testWidgets(
    'permissionDenied state renders guidance text and a grant button',
    (tester) async {
      await pumpWithState(tester, const FacePermissionDenied());

      expect(find.text('Kameraga ruxsat kerak'), findsOneWidget);
      expect(
        find.text(
          "Yuzingizni ro'yxatdan o'tkazish uchun kameradan "
          'foydalanishga ruxsat bering',
        ),
        findsOneWidget,
      );
      expect(find.text('Ruxsat berish'), findsOneWidget);
    },
  );

  testWidgets('searching state renders the hold-still oval prompt', (
    tester,
  ) async {
    await pumpWithState(tester, const FaceSearching());

    expect(find.text('Yuzingizni ovalga joylang'), findsOneWidget);
  });
}
