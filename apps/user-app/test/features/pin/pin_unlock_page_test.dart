import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/auth/domain/usecases/restore_session.dart';
import 'package:user_app/features/auth/domain/usecases/send_otp.dart';
import 'package:user_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/pin/domain/usecases/set_pin.dart';
import 'package:user_app/features/pin/domain/usecases/verify_pin.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';
import 'package:user_app/features/pin/presentation/pages/pin_unlock_page.dart';

class _MockSetPin extends Mock implements SetPin {}

class _MockVerifyPin extends Mock implements VerifyPin {}

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockRestoreSession extends Mock implements RestoreSession {}

void main() {
  late SetPin setPin;
  late VerifyPin verifyPin;

  setUpAll(() {
    registerFallbackValue(const VerifyPinParams('0000'));
  });

  setUp(() {
    setPin = _MockSetPin();
    verifyPin = _MockVerifyPin();
  });

  Future<void> pumpPage(WidgetTester tester) async {
    final authCubit = AuthCubit(
      sendOtp: _MockSendOtp(),
      verifyOtp: _MockVerifyOtp(),
      restoreSession: _MockRestoreSession(),
    );
    addTearDown(authCubit.close);

    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, _) => BlocProvider(
            create: (_) => PinCubit(setPin: setPin, verifyPin: verifyPin),
            child: const PinUnlockPage(),
          ),
        ),
        GoRoute(
          path: '/home',
          builder: (context, _) =>
              const Scaffold(body: Text('home-placeholder')),
        ),
      ],
    );

    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [BlocProvider<AuthCubit>.value(value: authCubit)],
        child: MaterialApp.router(
          locale: const Locale('uz'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: router,
        ),
      ),
    );
    // The page's `flutter_animate` entrance effects (fadeIn/slideY/scale on
    // the header icon, title, subtitle, PIN input) schedule their own
    // Timers — settle them here so no test ends with one still pending
    // (widget tests fail that invariant check regardless of the assertion
    // outcome).
    await tester.pumpAndSettle();
  }

  Future<void> tapDigits(WidgetTester tester, String digits) async {
    for (final digit in digits.split('')) {
      await tester.tap(find.text(digit).first);
      await tester.pump();
    }
  }

  testWidgets('renders the unlock title and subtitle', (tester) async {
    await pumpPage(tester);

    expect(find.text('PIN kodni kiriting'), findsOneWidget);
    expect(
      find.text('Davom etish uchun PIN kodingizni kiriting'),
      findsOneWidget,
    );
  });

  testWidgets('a wrong PIN shows the inline error and does NOT navigate', (
    tester,
  ) async {
    when(() => verifyPin(any())).thenAnswer((_) async => const Right(false));
    await pumpPage(tester);

    await tapDigits(tester, '0000');
    await tester.pump();

    expect(find.text("Noto'g'ri PIN kod"), findsOneWidget);
    expect(find.text('home-placeholder'), findsNothing);
  });

  testWidgets('the correct PIN navigates home', (tester) async {
    when(() => verifyPin(any())).thenAnswer((_) async => const Right(true));
    await pumpPage(tester);

    await tapDigits(tester, '1234');
    // `_proceedToHome` waits 250ms before calling `context.go('/home')` —
    // pump well past that so no Timer is left pending at test end, then
    // settle so the newly-pushed `/home` route finishes building.
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    verify(() => verifyPin(const VerifyPinParams('1234'))).called(1);
    expect(find.text('home-placeholder'), findsOneWidget);
  });
}
