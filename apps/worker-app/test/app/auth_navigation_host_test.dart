import 'dart:async';


import 'package:dartz/dartz.dart';
// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/app/auth_navigation_host.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/usecases/login_employee.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockLoginEmployee extends Mock implements LoginEmployee {}

class _MockRestoreSession extends Mock implements RestoreSession {}

const _session = AuthSession(
  token: 't',
  workerId: 'W-1',
  name: 'Ali',
  position: 'P',
  region: 'R',
);

void main() {
  setUpAll(() {
    registerFallbackValue(const VerifyOtpParams(phone: '', code: ''));
  });

  Future<(AuthCubit, GoRouter)> pumpApp(WidgetTester tester) async {
    final verifyOtp = _MockVerifyOtp();
    when(() => verifyOtp(any())).thenAnswer((_) async => const Right(_session));
    final auth = AuthCubit(
      sendOtp: _MockSendOtp(),
      verifyOtp: verifyOtp,
      loginEmployee: _MockLoginEmployee(),
      restoreSession: _MockRestoreSession(),
    );
    addTearDown(auth.close);
    await auth.verifyOtp('+998', '1111');

    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/login',
          builder: (_, _) => const Scaffold(body: Text('login-page')),
        ),
        GoRoute(
          path: '/home',
          builder: (_, _) => const Scaffold(body: Text('home-page')),
          routes: [
            GoRoute(
              path: 'nested',
              builder: (_, _) => const Scaffold(body: Text('nested-page')),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      BlocProvider.value(
        value: auth,
        child: MaterialApp.router(
          routerConfig: router,
          builder: (context, child) =>
              AuthNavigationHost(router: router, child: child!),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return (auth, router);
  }

  testWidgets(
    'logout from a nested route with an open dialog and sheet lands on '
    '/login with nothing left on top',
    (tester) async {
      final (auth, router) = await pumpApp(tester);
      unawaited(router.push('/home/nested'));
      await tester.pumpAndSettle();
      final ctx = tester.element(find.text('nested-page'));
      unawaited(
        showModalBottomSheet<void>(
          context: ctx,
          builder: (_) => const Text('a-sheet'),
        ),
      );
      await tester.pumpAndSettle();
      unawaited(
        showDialog<void>(
          context: ctx,
          barrierDismissible: false,
          builder: (_) => const AlertDialog(content: Text('a-dialog')),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('a-dialog'), findsOneWidget);

      auth.reset();
      await tester.pumpAndSettle();

      expect(find.text('login-page'), findsOneWidget);
      expect(find.text('a-dialog'), findsNothing);
      expect(find.text('a-sheet'), findsNothing);
      expect(find.text('nested-page'), findsNothing);
      expect(
        router.routerDelegate.currentConfiguration.uri.path,
        '/login',
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('non-logout auth changes do not navigate', (tester) async {
    final (auth, _) = await pumpApp(tester);
    auth.markFaceEnrolled();
    await tester.pumpAndSettle();
    expect(find.text('home-page'), findsOneWidget);
  });
}
