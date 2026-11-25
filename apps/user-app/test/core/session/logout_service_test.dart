import 'dart:async';

import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/core/session/logout_service.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/auth/domain/usecases/restore_session.dart';
import 'package:user_app/features/auth/domain/usecases/send_otp.dart';
import 'package:user_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

class _MockNotificationsCubit extends Mock implements NotificationsCubit {}

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockRestoreSession extends Mock implements RestoreSession {}

const _session = AuthSession(
  token: 't',
  userId: 'U-1',
  name: 'Aziz',
  phone: '901234567',
  region: 'Chilonzor',
);

void main() {
  late _MockAuthRepository repository;
  late _MockNotificationsCubit notifications;
  late AuthCubit authCubit;

  setUpAll(() {
    registerFallbackValue(const VerifyOtpParams(phone: '', code: ''));
  });

  setUp(() async {
    repository = _MockAuthRepository();
    notifications = _MockNotificationsCubit();
    when(() => repository.logout()).thenAnswer((_) async {});
    when(() => notifications.clear()).thenAnswer((_) async {});
    final verifyOtp = _MockVerifyOtp();
    when(() => verifyOtp(any())).thenAnswer((_) async => const Right(_session));
    authCubit = AuthCubit(
      sendOtp: _MockSendOtp(),
      verifyOtp: verifyOtp,
      restoreSession: _MockRestoreSession(),
    );
    await authCubit.verifyOtp('901234567', '123456');
    authCubit
      ..markRegistered()
      ..markFaceEnrolled()
      ..markPinSet();
  });

  tearDown(() => authCubit.close());

  LogoutService build({GoRouter Function()? router}) => LogoutService(
    authRepository: repository,
    authCubit: authCubit,
    notificationsCubit: notifications,
    router: router ?? () => throw StateError('no router in this test'),
  );

  test('clears storage, notifications and auth state (session expiry path '
      'without a router still logs out fully)', () async {
    await build().logout();

    verify(() => repository.logout()).called(1);
    verify(() => notifications.clear()).called(1);
    expect(authCubit.state, const AuthState());
  });

  test('a storage error does not stop the logout', () async {
    when(() => repository.logout()).thenThrow(Exception('disk'));

    await build().logout();

    verify(() => notifications.clear()).called(1);
    expect(authCubit.state.isAuthenticated, isFalse);
  });

  test(
    'parallel calls (several 401s at once) run the logout only once',
    () async {
      final gate = Completer<void>();
      when(() => repository.logout()).thenAnswer((_) => gate.future);
      final service = build();

      final a = service.logout();
      final b = service.logout();
      gate.complete();
      await Future.wait([a, b]);

      verify(() => repository.logout()).called(1);
    },
  );

  testWidgets('closes open dialogs and lands on /login', (tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, _) => const Scaffold(body: Text('home-page')),
        ),
        GoRoute(
          path: '/login',
          builder: (context, _) => const Scaffold(body: Text('login-page')),
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    unawaited(
      showDialog<void>(
        context: tester.element(find.text('home-page')),
        builder: (_) => const AlertDialog(content: Text('open-dialog')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('open-dialog'), findsOneWidget);

    await tester.runAsync(() => build(router: () => router).logout());
    await tester.pumpAndSettle();

    expect(find.text('open-dialog'), findsNothing);
    expect(find.text('login-page'), findsOneWidget);
    expect(authCubit.state.isAuthenticated, isFalse);
  });
}
