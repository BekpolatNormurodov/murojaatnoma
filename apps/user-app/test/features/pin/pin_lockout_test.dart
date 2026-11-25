import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/core/session/logout_service.dart';
import 'package:user_app/features/pin/data/datasources/pin_attempt_store.dart';
import 'package:user_app/features/pin/domain/usecases/set_pin.dart';
import 'package:user_app/features/pin/domain/usecases/verify_pin.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';
import 'package:user_app/features/pin/presentation/pages/pin_unlock_page.dart';
import 'package:user_app/injection.dart';

import '../../support/fonts.dart';
import '../../support/small_screen.dart';

class _SetPin extends Mock implements SetPin {}

class _VerifyPin extends Mock implements VerifyPin {}

class _Logout extends Mock implements LogoutService {}

void main() {
  late _VerifyPin verifyPin;
  late _Logout logout;
  late PinAttemptStore attempts;

  setUpAll(() async {
    await loadTestFonts();
    registerFallbackValue(const VerifyPinParams('0000'));
  });

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    attempts = PinAttemptStore(const FlutterSecureStorage());
    verifyPin = _VerifyPin();
    when(() => verifyPin(any())).thenAnswer((_) async => const Right(false));
    logout = _Logout();
    when(
      () => logout.logout(
        router: any(named: 'router'),
        forgetPin: any(named: 'forgetPin'),
      ),
    ).thenAnswer((_) async {});
    getIt.registerSingleton<LogoutService>(logout);
  });

  tearDown(getIt.reset);

  PinCubit cubit() =>
      PinCubit(setPin: _SetPin(), verifyPin: verifyPin, attempts: attempts);

  test('the attempt counter survives an app restart', () async {
    final first = cubit();
    for (var i = 0; i < PinCubit.maxAttempts; i++) {
      await first.verifyPin('0000');
    }
    expect(first.state, const PinLockedOut());
    await first.close();

    clearInteractions(verifyPin);
    final second = cubit();
    await second.verifyPin('1234');

    expect(second.state, const PinLockedOut());
    verifyNever(() => verifyPin(any()));
    await second.close();
  });

  Future<void> pumpPage(WidgetTester tester) async {
    useSmallScreen(tester);
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => BlocProvider(
            create: (_) => cubit(),
            child: const PinUnlockPage(lockoutDelay: Duration(seconds: 1)),
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
    await tester.pumpAndSettle();
  }

  testWidgets('forgot PIN: confirm logs out and removes the PIN (360x640)', (
    tester,
  ) async {
    await pumpPage(tester);
    expect(tester.takeException(), isNull);
    final l10n = lookupAppLocalizations(const Locale('uz'));
    final forgot = find.text('PIN kodni unutdingizmi? Chiqish');
    await tester.ensureVisible(forgot);
    await tester.tap(forgot);
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.logoutConfirmCta));
    await tester.pumpAndSettle();

    verify(
      () => logout.logout(router: any(named: 'router'), forgetPin: true),
    ).called(1);
    await drainFonts(tester);
  });

  testWidgets('while the logout is waiting for the server the page cannot be '
      'used again', (tester) async {
    final gate = Completer<void>();
    when(
      () => logout.logout(
        router: any(named: 'router'),
        forgetPin: any(named: 'forgetPin'),
      ),
    ).thenAnswer((_) => gate.future);
    await pumpPage(tester);
    final l10n = lookupAppLocalizations(const Locale('uz'));
    final forgot = find.text('PIN kodni unutdingizmi? Chiqish');
    await tester.ensureVisible(forgot);
    await tester.tap(forgot);
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.logoutConfirmCta));
    await tester.pump(const Duration(seconds: 1));

    final button = find.ancestor(of: forgot, matching: find.byType(TextButton));
    expect(tester.widget<TextButton>(button).onPressed, isNull);
    await tester.tap(find.text('0').first, warnIfMissed: false);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    gate.complete();
    await tester.pumpAndSettle();
    expect(tester.widget<TextButton>(button).onPressed, isNotNull);
    await drainFonts(tester);
  });

  testWidgets('running out of attempts forces a logout', (tester) async {
    await attempts.write(PinCubit.maxAttempts - 1);
    await pumpPage(tester);

    for (var i = 0; i < 4; i++) {
      await tester.tap(find.text('0').first);
      await tester.pump();
    }
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    verify(
      () => logout.logout(router: any(named: 'router'), forgetPin: true),
    ).called(1);
    await drainFonts(tester);
  });
}
