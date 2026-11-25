import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
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
import 'package:user_app/features/auth/presentation/pages/phone_input_page.dart';

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockRestoreSession extends Mock implements RestoreSession {}

/// `/otp` o'rnida yengil sahifa — haqiqiy `OtpPage`ning taymer/animatsiyalari
/// bu testga kerak emas; faqat necha marta push qilinganini sanaymiz.
class _OtpStub extends StatelessWidget {
  const _OtpStub();

  @override
  Widget build(BuildContext context) => const Scaffold(body: Text('otp-stub'));
}

void main() {
  late _MockSendOtp sendOtp;
  late AuthCubit cubit;

  setUpAll(() {
    registerFallbackValue(const SendOtpParams(''));
  });

  setUp(() {
    sendOtp = _MockSendOtp();
    when(() => sendOtp(any())).thenAnswer((_) async => const Right(unit));
    cubit = AuthCubit(
      sendOtp: sendOtp,
      verifyOtp: _MockVerifyOtp(),
      restoreSession: _MockRestoreSession(),
    );
  });

  tearDown(() => cubit.close());

  Future<GoRouter> pump(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/login',
      routes: [
        GoRoute(path: '/login', builder: (_, _) => const PhoneInputPage()),
        GoRoute(path: '/otp', builder: (_, _) => const _OtpStub()),
      ],
    );
    await tester.pumpWidget(
      BlocProvider<AuthCubit>.value(
        value: cubit,
        child: MaterialApp.router(
          theme: AppTheme.light,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: router,
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    return router;
  }

  /// GoRouter `push` ichkarida asinxron hal qilinadi — bir nechta kadr kerak
  /// (`pumpAndSettle` emas: autofocus kursori cheksiz kadr so'raydi).
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  testWidgets('resending the code from /otp does not push a second /otp '
      'page from the phone page underneath', (tester) async {
    await pump(tester);

    await cubit.requestOtp('+998 90 123 45 67');
    await settle(tester);
    expect(find.text('otp-stub'), findsOneWidget);

    // "Qayta yuborish" — the OTP page calls requestOtp again.
    await cubit.requestOtp('+998 90 123 45 67');
    await settle(tester);

    expect(find.text('otp-stub', skipOffstage: false), findsOneWidget);
    verify(() => sendOtp(any())).called(2);
  });

  testWidgets('an error while /otp is on top is not shown by the phone page', (
    tester,
  ) async {
    await pump(tester);
    await cubit.requestOtp('+998 90 123 45 67');
    await settle(tester);

    when(
      () => sendOtp(any()),
    ).thenAnswer((_) async => const Left(ServerFailure('Juda tez')));
    await cubit.requestOtp('+998 90 123 45 67');
    await settle(tester);

    // The stub /otp page shows no alerts itself, so any snackbar would have
    // come from the phone page underneath.
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('on the phone page itself an error is still shown', (
    tester,
  ) async {
    when(
      () => sendOtp(any()),
    ).thenAnswer((_) async => const Left(ServerFailure('Juda tez')));
    await pump(tester);

    await cubit.requestOtp('+998 90 123 45 67');
    await settle(tester);

    expect(find.text('Juda tez'), findsOneWidget);
    expect(find.text('otp-stub'), findsNothing);
  });
}
