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
import 'package:user_app/features/pin/presentation/pages/pin_set_page.dart';

class _MockSetPin extends Mock implements SetPin {}

class _MockVerifyPin extends Mock implements VerifyPin {}

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockRestoreSession extends Mock implements RestoreSession {}

void main() {
  late SetPin setPin;
  late VerifyPin verifyPin;

  setUpAll(() {
    registerFallbackValue(const SetPinParams('0000'));
  });

  setUp(() {
    setPin = _MockSetPin();
    verifyPin = _MockVerifyPin();
  });

  /// `PinSetPage` itself never touches go_router synchronously during
  /// build — only inside the delayed, post-success `_proceedToHome`
  /// callback (`AuthCubit.markPinSet()` + `context.go('/home')`). A real
  /// `AuthCubit` (mocked usecases, never stubbed — `markPinSet()` doesn't
  /// call any of them) and a real (single extra `/home` placeholder
  /// route) `GoRouter` are wired here so that callback resolves cleanly
  /// in the one test that reaches `PinSetSuccess`, instead of throwing
  /// for a missing provider/router ancestor.
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
            child: const PinSetPage(),
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

  testWidgets('renders the first-entry title and subtitle', (tester) async {
    await pumpPage(tester);

    expect(find.text("PIN kod o'rnating"), findsOneWidget);
    expect(
      find.text(
        'Ilovaga tezkor va xavfsiz kirish uchun 4 xonali PIN kod yarating',
      ),
      findsOneWidget,
    );
  });

  testWidgets(
    'entering 4 digits moves to the confirmation step (title + subtitle '
    'change, no PIN persisted yet)',
    (tester) async {
      await pumpPage(tester);

      await tapDigits(tester, '1234');
      await tester.pump();

      expect(find.text('PIN kodni tasdiqlang'), findsOneWidget);
      expect(
        find.text('Tanlagan PIN kodingizni yana bir marta kiriting'),
        findsOneWidget,
      );
      verifyNever(() => setPin(any()));
    },
  );

  testWidgets(
    'a mismatched confirmation shows the mismatch error and returns to '
    'the first-entry step, WITHOUT ever persisting the PIN',
    (tester) async {
      await pumpPage(tester);

      await tapDigits(tester, '1234'); // first entry
      await tester.pump();
      await tapDigits(tester, '9999'); // mismatched confirmation
      await tester.pump();

      expect(
        find.text("PIN kodlar mos kelmadi. Qaytadan urinib ko'ring"),
        findsOneWidget,
      );
      // Back to the first-entry step (title reverted).
      expect(find.text("PIN kod o'rnating"), findsOneWidget);
      verifyNever(() => setPin(any()));
    },
  );

  testWidgets(
    'a matching confirmation persists the ORIGINAL pin via SetPin and '
    'eventually navigates home',
    (tester) async {
      when(() => setPin(any())).thenAnswer((_) async => const Right(unit));
      await pumpPage(tester);

      await tapDigits(tester, '1234'); // first entry
      await tester.pump();
      await tapDigits(tester, '1234'); // matching confirmation
      await tester.pump();

      verify(() => setPin(const SetPinParams('1234'))).called(1);

      // `_proceedToHome` waits 900ms before calling `context.go('/home')` —
      // pump well past that so the pending Future/Timer fully resolves
      // (a widget test must not end with a Timer still pending), then
      // settle so the newly-pushed `/home` route finishes building.
      await tester.pump(const Duration(milliseconds: 1000));
      await tester.pumpAndSettle();
      expect(find.text('home-placeholder'), findsOneWidget);
    },
  );
}
