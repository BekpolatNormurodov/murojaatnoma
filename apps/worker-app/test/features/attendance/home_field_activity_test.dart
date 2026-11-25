import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/attendance/domain/entities/attendance_day.dart';
import 'package:worker_app/features/attendance/domain/entities/check_scan_result.dart';
import 'package:worker_app/features/attendance/domain/entities/my_attendance.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/attendance/domain/services/geofence_service.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_in.dart';
import 'package:worker_app/features/attendance/domain/usecases/check_out.dart';
import 'package:worker_app/features/attendance/presentation/bloc/attendance_cubit.dart';
import 'package:worker_app/features/attendance/presentation/pages/home_page.dart';
import 'package:worker_app/features/attendance/presentation/widgets/today_status_card.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/injection.dart';

class _Repo extends Mock implements AttendanceRepository {}

class _Notifications extends Mock implements NotificationsRepository {}

class _Auth extends Mock implements AuthCubit {}

AttendanceDay _day({String? checkIn, String? checkOut, double hours = 0}) =>
    AttendanceDay(
      date: '2026-11-25',
      checkIn: checkIn,
      checkOut: checkOut,
      status: AttendanceStatus.present,
      hours: hours,
      insideGeofence: true,
      selfConfirmed: checkIn != null,
      confirmedAt: checkIn,
    );

MyAttendance _me(AttendanceDay today, {bool faceRequired = false}) =>
    MyAttendance(
      employeeId: 'E',
      fullName: 'F',
      department: 'D',
      workStartTime: '09:00',
      faceRequired: faceRequired,
      today: today,
      week: [today],
    );

final _position = Position(
  latitude: 41.31,
  longitude: 69.34,
  timestamp: DateTime(2026, 11, 25, 12),
  accuracy: 10,
  altitude: 0,
  altitudeAccuracy: 0,
  heading: 0,
  headingAccuracy: 0,
  speed: 0,
  speedAccuracy: 0,
);

void main() {
  late _Repo repo;
  late _Auth auth;
  late AttendanceCubit cubit;
  late DateTime now;
  var loads = 0;

  setUpAll(() {
    SharedPreferences.setMockInitialValues({});
    if (!getIt.isRegistered<DioClient>()) {
      getIt.registerSingleton<DioClient>(DioClient());
    }
  });

  setUp(() {
    now = DateTime(2026, 11, 25, 12, 30);
    loads = 0;
    repo = _Repo();
    auth = _Auth();
    when(() => auth.state).thenReturn(const AuthState());
    when(() => auth.stream).thenAnswer((_) => const Stream.empty());
    when(
      () => auth.setFaceRequired(isRequired: any(named: 'isRequired')),
    ).thenReturn(null);
    when(
      () => repo.checkOut(
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
        accuracy: any(named: 'accuracy'),
      ),
    ).thenAnswer(
      (_) async => Right(
        CheckScanResult(
          isValid: true,
          faceScore: 0,
          type: 'CHECK_OUT',
          isLate: false,
          lateMinutes: 0,
          recordedAt: DateTime(2026, 11, 25, 12, 30),
        ),
      ),
    );
  });

  void answer(MyAttendance Function() me) =>
      when(repo.myAttendance).thenAnswer((_) async {
        loads++;
        return Right(me());
      });

  Future<void> pumpHome(WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final geofence = GeofenceService();
    cubit = AttendanceCubit(
      repository: repo,
      geofence: geofence,
      checkIn: CheckIn(repo, geofence, localGate: false),
      checkOut: CheckOut(repo, geofence, localGate: false),
      locate: () async => _position,
    );
    addTearDown(cubit.close);
    final notifications = NotificationsCubit(
      repository: _Notifications(),
      authCubit: auth,
    );
    addTearDown(notifications.close);
    await cubit.load();
    await tester.pumpWidget(
      MaterialApp.router(
        theme: AppTheme.light,
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: GoRouter(
          routes: [
            // Haqiqiy ilovadagidek: bosh sahifa tab (shell) navigatorida.
            ShellRoute(
              builder: (_, _, child) => child,
              routes: [
                GoRoute(
                  path: '/',
                  builder: (_, _) => MultiBlocProvider(
                    providers: [
                      BlocProvider<AuthCubit>.value(value: auth),
                      BlocProvider<AttendanceCubit>.value(value: cubit),
                      BlocProvider<NotificationsCubit>.value(
                        value: notifications,
                      ),
                    ],
                    child: HomePage(now: () => now),
                  ),
                ),
              ],
            ),
            GoRoute(
              path: '/face/checkout',
              builder: (_, _) => const Text('CAMERA'),
            ),
          ],
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
  }

  Future<void> tapCheckOut(WidgetTester tester) async {
    await tester.tap(find.text('Ishdan chiqish'));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
  }

  Future<void> finish(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(minutes: 1));
  }

  testWidgets('location-only check-out asks first; cancel records nothing', (
    tester,
  ) async {
    answer(() => _me(_day(checkIn: '09:00')));
    await pumpHome(tester);
    await tapCheckOut(tester);
    expect(find.text('Ishdan chiqasizmi?'), findsOneWidget);
    expect(find.textContaining('12:30'), findsOneWidget);
    await tester.tap(find.text('Bekor qilish'));
    await tester.pump(const Duration(seconds: 1));
    verifyNever(
      () => repo.checkOut(
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
        accuracy: any(named: 'accuracy'),
      ),
    );
    await finish(tester);
  });

  testWidgets('confirming check-out records it and keeps the home page', (
    tester,
  ) async {
    answer(() => _me(_day(checkIn: '09:00')));
    await pumpHome(tester);
    await tapCheckOut(tester);
    await tester.tap(find.text('Ha, chiqaman'));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }

    expect(tester.takeException(), isNull);
    expect(find.text('Ishdan chiqasizmi?'), findsNothing);
    expect(find.byType(HomePage), findsOneWidget);
    verify(
      () => repo.checkOut(
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
        accuracy: any(named: 'accuracy'),
      ),
    ).called(1);
    await finish(tester);
  });

  testWidgets('the admin switch is re-read at the moment of the tap', (
    tester,
  ) async {
    var faceRequired = false;
    answer(() => _me(_day(checkIn: '09:00'), faceRequired: faceRequired));
    await pumpHome(tester);
    faceRequired = true; // admin turns the face scan on
    final before = loads;
    await tapCheckOut(tester);
    expect(loads, greaterThan(before));
    // No location-only confirmation: the face flow took over.
    expect(find.text('Ishdan chiqasizmi?'), findsNothing);
    await finish(tester);
  });

  testWidgets('a new day and returning to the app reload attendance', (
    tester,
  ) async {
    answer(() => _me(_day()));
    await pumpHome(tester);
    var before = loads;
    await tester.pump(const Duration(seconds: 31));
    expect(loads, before, reason: 'same day');
    now = DateTime(2026, 11, 26, 0, 1);
    await tester.pump(const Duration(seconds: 31));
    expect(loads, before + 1);

    before = loads;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(loads, before + 1);
    await finish(tester);
  });

  testWidgets('a finished day leaves no double gap where the button was', (
    tester,
  ) async {
    answer(() => _me(_day(checkIn: '08:55', checkOut: '18:04', hours: 9.15)));
    await pumpHome(tester);
    final report = find.byWidgetPredicate(
      (w) => '${w.runtimeType}' == '_DailyReportCard',
    );
    expect(
      tester.getTopLeft(report).dy -
          tester.getBottomLeft(find.byType(TodayStatusCard)).dy,
      16,
    );
    await finish(tester);
  });

  testWidgets('today card shows both times and the worked duration', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: TodayStatusCard(
            today: _day(checkIn: '08:55', checkOut: '18:04', hours: 9.15),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('08:55'), findsOneWidget);
    expect(find.text('18:04'), findsOneWidget);
    expect(find.text('9 soat 9 daq'), findsOneWidget);
    await finish(tester);
  });
}
