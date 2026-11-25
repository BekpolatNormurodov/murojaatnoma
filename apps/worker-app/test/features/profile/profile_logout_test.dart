import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dartz/dartz.dart';
// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/app/auth_navigation_host.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/usecases/login_employee.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/profile/presentation/pages/profile_page.dart';
import 'package:worker_app/injection.dart';

class _SendOtp extends Mock implements SendOtp {}

class _VerifyOtp extends Mock implements VerifyOtp {}

class _Login extends Mock implements LoginEmployee {}

class _Restore extends Mock implements RestoreSession {}

/// Profil — haqiqiy ilovadagidek TAB ichida (shell branch). Chiqishni
/// tasdiqlash dialogi shu holatda ishlashi shart.
void main() {
  setUpAll(
    () => registerFallbackValue(const VerifyOtpParams(phone: '', code: '')),
  );

  Future<AuthCubit> pump(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await getIt.reset();
    final verify = _VerifyOtp();
    when(() => verify(any())).thenAnswer(
      (_) async => const Right(
        AuthSession(
          token: 't',
          workerId: 'W',
          name: 'Ali Valiyev',
          position: 'P',
          region: 'R',
        ),
      ),
    );
    final auth = AuthCubit(
      sendOtp: _SendOtp(),
      verifyOtp: verify,
      loginEmployee: _Login(),
      restoreSession: _Restore(),
    );
    await auth.verifyOtp('1', '1');
    getIt.registerSingleton<AuthCubit>(auth);
    addTearDown(() async {
      await getIt.reset();
      await auth.close();
    });

    final router = GoRouter(
      initialLocation: '/profile',
      routes: [
        GoRoute(
          path: '/login',
          builder: (_, _) => const Scaffold(body: Text('login-page')),
        ),
        StatefulShellRoute.indexedStack(
          builder: (_, _, shell) => Scaffold(body: shell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/profile',
                  builder: (_, _) => const ProfilePage(),
                ),
              ],
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);
    tester.view
      ..physicalSize = const Size(360, 640)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: auth),
          BlocProvider(create: (_) => LocaleCubit()),
          BlocProvider(create: (_) => ThemeCubit()),
        ],
        child: MaterialApp.router(
          locale: const Locale('uz'),
          theme: AppTheme.light,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: router,
          builder: (_, child) =>
              AuthNavigationHost(router: router, child: child!),
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    final button = find.widgetWithText(AppButton, 'Chiqish');
    await tester.scrollUntilVisible(
      button,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(button);
    await tester.pump(const Duration(seconds: 1));
    return auth;
  }

  testWidgets('cancel closes only the dialog', (tester) async {
    final auth = await pump(tester);
    await tester.tap(find.text('Bekor qilish'));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull);
    expect(find.byType(Dialog), findsNothing);
    expect(find.byType(ProfilePage), findsOneWidget);
    expect(auth.state.isAuthenticated, isTrue);
  });

  testWidgets('confirm signs out and shows the login page', (tester) async {
    final auth = await pump(tester);
    await tester.tap(find.byType(AppButton).hitTestable().first);
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(tester.takeException(), isNull);
    expect(auth.state.isAuthenticated, isFalse);
    expect(find.text('login-page'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byType(Dialog), findsNothing);
  });
}
