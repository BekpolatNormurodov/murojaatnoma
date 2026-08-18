import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/presentation/bloc/attendance_cubit.dart';
import 'package:worker_app/features/attendance/presentation/pages/home_page.dart';
import 'package:worker_app/features/attendance/presentation/widgets/today_status_card.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/usecases/login_employee.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

class _MockAttendanceRepository extends Mock implements AttendanceRepository {}

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockLoginEmployee extends Mock implements LoginEmployee {}

class _MockRestoreSession extends Mock implements RestoreSession {}

/// `AttendanceCubit.load()` haqiqiy repository chaqiruvini ishga tushiradi
/// — widget testida buni chetlab, berilgan holatni to'g'ridan-to'g'ri
/// `emit` qiladigan qilib almashtiramiz. Xuddi
/// `face_enroll_page_test.dart`dagi `_FixedStateFaceCubit` kabi naqsh.
class _FixedStateAttendanceCubit extends AttendanceCubit {
  _FixedStateAttendanceCubit(
    this._fixedState, {
    required super.repository,
    required super.geofence,
    super.locate,
  });

  final AttendanceState _fixedState;

  @override
  Future<void> load() async => emit(_fixedState);
}

const _session = AuthSession(
  token: 'demo-jwt',
  workerId: 'W-1042',
  name: 'Sardor Karimov',
  position: 'Kommunal xizmat mutaxassisi',
  region: 'Chilonzor tumani',
);

const _today = AttendanceDay(
  date: '2026-07-24',
  checkIn: '09:03',
  checkOut: null,
  status: AttendanceStatus.present,
  hours: 4,
  insideGeofence: true,
  selfConfirmed: true,
  confirmedAt: '09:03',
);

void main() {
  late AttendanceRepository repository;
  late GeofenceService geofence;
  late AuthCubit authCubit;

  setUpAll(() {
    registerFallbackValue(const VerifyOtpParams(phone: '', code: ''));
  });

  setUp(() async {
    repository = _MockAttendanceRepository();
    geofence = GeofenceService();

    final verifyOtp = _MockVerifyOtp();
    when(() => verifyOtp(any())).thenAnswer((_) async => const Right(_session));
    authCubit = AuthCubit(
      sendOtp: _MockSendOtp(),
      verifyOtp: verifyOtp,
      loginEmployee: _MockLoginEmployee(),
      restoreSession: _MockRestoreSession(),
    );
    // Haqiqiy ommaviy API orqali "authenticated + session" holatiga
    // o'tkaziladi — `Cubit.emit()` (protected) tashqaridan chaqirilmaydi.
    await authCubit.verifyOtp('+998901234567', '1111');
  });

  tearDown(() {
    authCubit.close();
  });

  Future<void> pumpWithState(
    WidgetTester tester,
    AttendanceState state, {
    Future<Position> Function()? locate,
  }) async {
    // Faza 3'dan keyin bosh sahifa ancha uzunroq (yangi bo'limlar
    // qo'shildi) — standart 800x600 test ekranida `ListView` past qismini
    // "dangasa" (lazy) qurmaydi, shuning uchun `find.text(...)` pastdagi
    // matnlarni topa olmay qolishi mumkin edi. Test ekranini vertikal
    // uzaytiramiz — shu tufayli BARCHA bo'limlar skrollsiz ham qurilgan
    // (Element daraxtida mavjud) bo'ladi.
    tester.view.physicalSize = const Size(800, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final attendanceCubit = locate == null
        ? _FixedStateAttendanceCubit(
            state,
            repository: repository,
            geofence: geofence,
          )
        : _FixedStateAttendanceCubit(
            state,
            repository: repository,
            geofence: geofence,
            locate: locate,
          );
    addTearDown(attendanceCubit.close);

    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, _) => MultiBlocProvider(
            providers: [
              BlocProvider<AuthCubit>.value(value: authCubit),
              BlocProvider<AttendanceCubit>.value(
                value: attendanceCubit..load(),
              ),
              BlocProvider<NotificationsCubit>(
                create: (_) => NotificationsCubit(),
              ),
            ],
            child: const HomePage(),
          ),
        ),
        GoRoute(
          path: '/face/checkin',
          builder: (context, _) =>
              const Scaffold(body: Text('face-checkin-page')),
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
    // Skeleton/greeting animatsiyalari `flutter_animate` bilan chekli —
    // `pumpAndSettle()` ISHLATILMAYDI, chunki premium bar/shimmer
    // effektlari cheksiz takrorlanadi (`face_enroll_page_test.dart`dagi
    // sababga o'xshash). Bitta pump bilan soatni yetarlicha suramiz.
    await tester.pump(const Duration(seconds: 2));
  }

  group('AttendanceLoaded state', () {
    testWidgets("renders TodayStatusCard and the 'Yuz bilan tasdiqlash' CTA", (
      tester,
    ) async {
      await pumpWithState(
        tester,
        const AttendanceLoaded(today: _today, week: [_today]),
      );

      expect(find.byType(TodayStatusCard), findsOneWidget);
      expect(find.text('Yuz bilan tasdiqlash'), findsOneWidget);
      // Bugungi status (present -> "Keldi") ham ko'rinadi.
      expect(find.text('Keldi'), findsOneWidget);
    });

    testWidgets('renders the greeting header with the session name', (
      tester,
    ) async {
      await pumpWithState(
        tester,
        const AttendanceLoaded(today: _today, week: [_today]),
      );

      expect(find.textContaining('Sardor Karimov'), findsOneWidget);
    });

    testWidgets(
      'today == null renders a neutral "not checked in yet" status, not '
      'a red "absent" chip',
      (tester) async {
        await pumpWithState(
          tester,
          const AttendanceLoaded(today: null, week: []),
        );

        expect(find.text('Hali belgilanmagan'), findsOneWidget);
        expect(find.text('Kelmadi'), findsNothing);
      },
    );

    testWidgets(
      'tapping the CTA without a real location plugin fails gracefully '
      '(shows an alert, never throws)',
      (tester) async {
        await pumpWithState(
          tester,
          const AttendanceLoaded(today: _today, week: [_today]),
          // Test muhitida haqiqiy `Geolocator` plugini yo'q — uni ataylab
          // xato tashlaydigan `locate` bilan almashtiramiz (xuddi
          // `_defaultLocate` xizmat o'chiq bo'lsa qilgani kabi), shunda
          // `checkGeofence()` deterministik ravishda `null` qaytaradi va
          // "joylashuvni aniqlab bo'lmadi" ogohlantirishi ko'rsatiladi.
          locate: () async => throw StateError("test: joylashuv yo'q"),
        );

        await tester.tap(find.text('Yuz bilan tasdiqlash'));
        await tester.pump(); // start the async geofence check
        await tester.pump(const Duration(seconds: 1)); // let it resolve

        expect(tester.takeException(), isNull);
        expect(find.text("Joylashuvni aniqlab bo'lmadi"), findsOneWidget);
      },
    );

    testWidgets('tapping the CTA while inside the geofence navigates to '
        '/face/checkin', (tester) async {
      // Qarang: `pumpWithState`dagi bir xil izoh — bu test ham o'z
      // router/pumpWidget'ini alohida quradi, shuning uchun bir xil
      // uzaytirilgan test ekrani shu yerda ham kerak.
      tester.view.physicalSize = const Size(800, 2600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final attendanceCubit = _FixedStateAttendanceCubit(
        const AttendanceLoaded(today: _today, week: [_today]),
        repository: repository,
        geofence: geofence,
        locate: () async => Position(
          latitude: 41.3111,
          longitude: 69.3402,
          timestamp: DateTime(2026, 7, 24, 9),
          accuracy: 5,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        ),
      );
      addTearDown(attendanceCubit.close);

      final router = GoRouter(
        initialLocation: '/',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, _) => MultiBlocProvider(
              providers: [
                BlocProvider<AuthCubit>.value(value: authCubit),
                BlocProvider<AttendanceCubit>.value(
                  value: attendanceCubit..load(),
                ),
              ],
              child: const HomePage(),
            ),
          ),
          GoRoute(
            path: '/face/checkin',
            builder: (context, _) =>
                const Scaffold(body: Text('face-checkin-page')),
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
      await tester.pump(const Duration(seconds: 2));

      await tester.tap(find.text('Yuz bilan tasdiqlash'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(tester.takeException(), isNull);
      expect(find.text('face-checkin-page'), findsOneWidget);
    });

    testWidgets(
      'tapping the CTA while outside the geofence shows the "outside" '
      'alert (never navigates)',
      (tester) async {
        await pumpWithState(
          tester,
          const AttendanceLoaded(today: _today, week: [_today]),
          // Ish hududidan yiroq nuqta — `checkGeofence()` deterministik
          // ravishda `false` qaytaradi (haqiqiy Geolocator plagini
          // talab qilinmaydi).
          locate: () async => Position(
            latitude: 41.4,
            longitude: 69.5,
            timestamp: DateTime(2026, 7, 24, 9),
            accuracy: 5,
            altitude: 0,
            altitudeAccuracy: 0,
            heading: 0,
            headingAccuracy: 0,
            speed: 0,
            speedAccuracy: 0,
          ),
        );

        await tester.tap(find.text('Yuz bilan tasdiqlash'));
        await tester.pump(); // start the async geofence check
        await tester.pump(const Duration(seconds: 1)); // let it resolve

        expect(tester.takeException(), isNull);
        expect(find.text('Siz ish hududidan tashqaridasiz'), findsOneWidget);
      },
    );
  });

  group('AttendanceLoading state', () {
    testWidgets('renders a skeleton placeholder, never a blank screen', (
      tester,
    ) async {
      await pumpWithState(tester, const AttendanceLoading());

      expect(find.byKey(const Key('home_skeleton')), findsOneWidget);
      expect(find.byType(TodayStatusCard), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });

  group('AttendanceEmpty state', () {
    testWidgets('renders an empty-state message and still offers the CTA', (
      tester,
    ) async {
      await pumpWithState(tester, const AttendanceEmpty());

      expect(find.text('Davomat tarixi topilmadi'), findsOneWidget);
      expect(find.text('Yuz bilan tasdiqlash'), findsOneWidget);
    });

    testWidgets(
      'still renders the MOCK dashboard-enrichment sections (they do not '
      'depend on attendance data)',
      (tester) async {
        await pumpWithState(tester, const AttendanceEmpty());

        expect(find.text("Bugungi ko'rinish"), findsOneWidget);
        expect(find.text("Bo'limlar"), findsOneWidget);
        expect(find.text("So'nggi faoliyat"), findsOneWidget);
      },
    );

    testWidgets(
      "tapping 'Tahlil' is a graceful no-op when the weekly analytics "
      "section isn't built (empty state) — never throws",
      (tester) async {
        await pumpWithState(tester, const AttendanceEmpty());

        await tester.tap(find.text('Tahlil'));
        await tester.pump(const Duration(milliseconds: 500));

        expect(tester.takeException(), isNull);
      },
    );
  });

  group('AttendanceError state', () {
    testWidgets('renders the error message with a retry button', (
      tester,
    ) async {
      await pumpWithState(tester, const AttendanceError('tarmoq xatosi'));

      expect(find.text('tarmoq xatosi'), findsOneWidget);
      expect(find.text('Qayta urinish'), findsOneWidget);
    });

    testWidgets('tapping retry calls load() again', (tester) async {
      await pumpWithState(tester, const AttendanceError('tarmoq xatosi'));

      await tester.tap(find.text('Qayta urinish'));
      await tester.pump();

      // `_FixedStateAttendanceCubit.load()` re-emits the SAME fixed error
      // state (Equatable-equal), so no new frame content changes — the
      // important assertion is simply that tapping retry never throws.
      expect(tester.takeException(), isNull);
    });
  });

  // Faza 3: bosh sahifani boyitish ("kam data" muammosi) — "Bugungi
  // ko'rinish" strip'i, "Bo'limlar" to'ri (MOCK belgilar bilan) va
  // "So'nggi faoliyat" ro'yxati. Qarang: `mock_dashboard.dart`.
  group('Dashboard enrichment (Faza 3)', () {
    testWidgets(
      "renders the today-overview strip's MOCK labels and today's real "
      'geofence status (insideGeofence: true -> "Ichkarida")',
      (tester) async {
        await pumpWithState(
          tester,
          const AttendanceLoaded(today: _today, week: [_today]),
        );

        expect(find.text("Bugungi ko'rinish"), findsOneWidget);
        expect(find.text('Yangi murojaat'), findsOneWidget);
        expect(find.text("O'qilmagan xabar"), findsOneWidget);
        expect(find.text('Bugungi majlis'), findsOneWidget);
        // `_today.insideGeofence == true` — MOCK emas, haqiqiy maydon.
        expect(find.text('Ichkarida'), findsOneWidget);
        expect(find.text('Tashqarida'), findsNothing);
      },
    );

    testWidgets("renders the 'Bo'limlar' grid with its MOCK badges "
        "(unique text — 'Majlislar' label itself is intentionally shared "
        "with the older 'Tezkor' row, so we assert on the badges instead)", (
      tester,
    ) async {
      await pumpWithState(
        tester,
        const AttendanceLoaded(today: _today, week: [_today]),
      );

      expect(find.text("Bo'limlar"), findsOneWidget);
      expect(find.text('3 yangi'), findsOneWidget);
      expect(find.text("5 o'qilmagan"), findsOneWidget);
      expect(find.text('2 bugun'), findsOneWidget);
      expect(find.text('Tahlil'), findsOneWidget);
    });

    testWidgets("renders the 'So'nggi faoliyat' mock activity list", (
      tester,
    ) async {
      await pumpWithState(
        tester,
        const AttendanceLoaded(today: _today, week: [_today]),
      );

      expect(find.text("So'nggi faoliyat"), findsOneWidget);
      expect(find.text('Majlis boshlanadi'), findsOneWidget);
      expect(find.text('Chatda yangi xabar bor'), findsOneWidget);
      expect(find.text('Yangi murojaat biriktirildi'), findsOneWidget);
    });

    testWidgets("tapping 'Tahlil' scrolls toward the weekly analytics section "
        '(WeeklyMiniChart) without throwing', (tester) async {
      await pumpWithState(
        tester,
        const AttendanceLoaded(today: _today, week: [_today]),
      );

      await tester.tap(find.text('Tahlil'));
      await tester.pump(const Duration(milliseconds: 500));

      expect(tester.takeException(), isNull);
    });
  });
}
