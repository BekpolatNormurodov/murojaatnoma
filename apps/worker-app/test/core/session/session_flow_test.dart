import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/realtime/uploads_service.dart';
import 'package:worker_app/core/session/session_bootstrap.dart';
import 'package:worker_app/core/session/session_service.dart';
import 'package:worker_app/features/attendance/data/attendance_settings_source.dart';
import 'package:worker_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:worker_app/features/auth/data/models/auth_session_model.dart';
import 'package:worker_app/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:worker_app/features/auth/domain/usecases/login_employee.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/chat/data/chat_outbox.dart';
import 'package:worker_app/features/chat/domain/usecases/send_message.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';
import 'package:worker_app/features/notifications/domain/repositories/notifications_repository.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';
import 'package:mocktail/mocktail.dart';

import '../../support/fake_http.dart';

class _Remote implements AuthRemoteDataSource {
  @override
  Future<AuthSessionModel> employeeLogin({
    required String username,
    required String password,
  }) async => AuthSessionModel(
    token: 'access-$username',
    refreshToken: 'refresh-$username',
    workerId: username,
    name: 'Xodim $username',
    position: 'P',
    region: 'R',
  );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Faces implements FaceLocalDataSource {
  FaceTemplate? template;

  @override
  Future<FaceTemplate?> read() async => template;

  @override
  Future<void> write(FaceTemplate t) async => template = t;

  @override
  Future<void> clear() async => template = null;
}

class _Photos implements FacePhotoStore {
  String? path;

  @override
  Future<String?> currentPath() async => path;

  @override
  Future<void> clear() async => path = null;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Notifications implements NotificationsRepository {
  final asked = <String>[];

  @override
  Future<Either<Failure, List<NotificationItem>>> list(String id) async {
    asked.add(id);
    return Right([
      NotificationItem(
        id: 'n-$id',
        type: NotificationType.general,
        title: 'T',
        body: 'B',
        createdAt: DateTime(2026, 11, 25),
      ),
    ]);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Send extends Mock implements SendMessage {}

class _Uploads extends Mock implements UploadsService {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late SharedPreferences prefs;
  late AuthCubit auth;
  late _Faces faces;
  late _Photos photos;
  late _Notifications notificationsRepo;
  late NotificationsCubit notifications;
  late LocationTrackingService tracking;
  late AuthRepositoryImpl repository;
  late bool faceRequired;

  setUp(() async {
    AppConfig.init(flavor: AppFlavor.dev, useMock: true);
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    await getIt.reset();
    faces = _Faces();
    photos = _Photos();
    faceRequired = false;
    repository = AuthRepositoryImpl(remote: _Remote(), prefs: prefs);
    auth = AuthCubit(
      sendOtp: SendOtp(repository),
      verifyOtp: VerifyOtp(repository),
      loginEmployee: LoginEmployee(repository),
      restoreSession: RestoreSession(repository),
      prepareSession: prepareSession,
    );
    notificationsRepo = _Notifications();
    notifications = NotificationsCubit(
      repository: notificationsRepo,
      authCubit: auth,
    );
    tracking = LocationTrackingService(
      FakeHttp(offline).dio(),
      ownerId: () => auth.state.session?.workerId,
    );
    getIt
      ..registerSingleton<SharedPreferences>(prefs)
      ..registerSingleton<AuthRepository>(repository)
      ..registerSingleton<AuthCubit>(auth)
      ..registerSingleton<FaceLocalDataSource>(faces)
      ..registerSingleton<FacePhotoStore>(photos)
      ..registerSingleton<AttendanceSettingsSource>(
        MockAttendanceSettingsSource(value: false),
      )
      ..registerSingleton<NotificationsCubit>(notifications)
      ..registerSingleton<LocationTrackingService>(tracking)
      ..registerSingleton<ChatOutbox>(ChatOutbox(_Send(), _Uploads()));
  });

  tearDown(() async {
    await notifications.close();
    await auth.close();
    await getIt.reset();
  });

  test('logout then login as another user leaks nothing', () async {
    await auth.login('A', 'x');
    await pumpEventQueue();
    expect(auth.state.isAuthenticated, isTrue);
    // The setting is known as soon as the state turns authenticated.
    expect(auth.state.faceRequired, faceRequired);
    expect(notifications.unreadCount, 1);

    faces.template = FaceTemplate(
      embedding: const [1],
      enrolledAt: DateTime(2026),
      workerId: 'A',
    );
    photos.path = '/a.jpg';
    await prefs.setStringList(LocationTrackingService.outboxKey, [
      jsonEncode({'latitude': 1, 'longitude': 2}),
    ]);

    await SessionService().logout();
    expect(auth.state.isAuthenticated, isFalse);
    expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), isNull);
    expect(await repository.currentSession(), isNull);
    expect(notifications.unreadCount, 0);
    // Unsent points survive, tagged with their owner.
    final kept = prefs.getStringList(LocationTrackingService.outboxKey)!;
    expect((jsonDecode(kept.single) as Map)['_owner'], 'A');

    await auth.login('B', 'x');
    await pumpEventQueue();
    expect(auth.state.session?.workerId, 'B');
    expect(auth.state.faceEnrolled, isFalse);
    expect(faces.template, isNull, reason: "A's face must be gone");
    expect(photos.path, isNull);
    expect(notificationsRepo.asked.last, 'B');
    final state = notifications.state as NotificationsLoaded;
    expect(state.items.single.id, 'n-B');
  });

  test('the same employee does not have to re-enrol after re-login', () async {
    await auth.login('A', 'x');
    faces.template = FaceTemplate(
      embedding: const [1],
      enrolledAt: DateTime(2026),
      workerId: 'A',
    );
    await SessionService().signOut(remote: false);
    await auth.login('A', 'x');
    expect(auth.state.faceEnrolled, isTrue);
  });

  test('concurrent sign-outs share one run', () async {
    await auth.login('A', 'x');
    final service = SessionService();
    final first = service.signOut(remote: true);
    final second = SessionService().signOut(remote: false);
    expect(identical(first, second), isTrue);
    await first;
  });

  test('a stored session without an access token is not restored', () async {
    await auth.login('A', 'x');
    await prefs.remove(AuthInterceptor.tokenKey);
    await prefs.remove(AuthInterceptor.refreshTokenKey);
    expect(await repository.currentSession(), isNull);
    // The stale login-time refresh token is not copied back.
    expect(prefs.getString(AuthInterceptor.refreshTokenKey), isNull);
  });
}
