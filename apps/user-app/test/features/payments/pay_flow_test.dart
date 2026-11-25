import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/auth/presentation/widgets/otp_input.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';
import 'package:user_app/features/payments/domain/usecases/pay_utility.dart';
import 'package:user_app/features/payments/presentation/bloc/pay_cubit.dart';
import 'package:user_app/features/payments/presentation/bloc/utilities_cubit.dart';
import 'package:user_app/features/payments/presentation/pages/pay_page.dart';
import 'package:user_app/features/payments/presentation/widgets/payment_otp_sheet.dart';
import 'package:user_app/injection.dart';

import '../../support/fonts.dart';
import '../../support/small_screen.dart';

class _PayUtility extends Mock implements PayUtility {}

class _GetUtilities extends Mock implements GetUtilities {}

class _Payment extends Mock implements Payment {}

const _utility = Utility(
  id: 'u1',
  lastInvoiceAt: '2026-11-01',
  type: UtilityType.gaz,
  accountNumber: '123456',
  balanceDue: 1000,
  provider: 'Hududgaz',
);

void main() {
  setUpAll(() async {
    await loadTestFonts();
    registerFallbackValue(const NoParams());
    registerFallbackValue(
      const PayUtilityParams(type: UtilityType.gaz, amount: 1, cardNumber: '1'),
    );
  });

  tearDown(getIt.reset);

  testWidgets('4-digit code closes the sheet, keeps the success dialog and '
      'then closes the pay page (360x640)', (tester) async {
    useSmallScreen(tester);
    final payUtility = _PayUtility();
    final payment = _Payment();
    when(() => payment.amount).thenReturn(1000);
    when(() => payUtility(any())).thenAnswer((_) async => Right(payment));
    final getUtilities = _GetUtilities();
    when(() => getUtilities(any())).thenAnswer((_) async => const Right([]));
    getIt
      ..registerSingleton(HomeCubit(getUtilities: getUtilities))
      ..registerSingleton(UtilitiesCubit(getUtilities: getUtilities));

    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: Text('start-page')),
        ),
        GoRoute(
          path: '/pay',
          builder: (_, _) => BlocProvider(
            create: (_) => PayCubit(payUtility: payUtility),
            child: const PayPage(utility: _utility),
          ),
        ),
      ],
    );
    final l10n = lookupAppLocalizations(const Locale('uz'));
    await tester.pumpWidget(
      MaterialApp.router(
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    );
    router.push('/pay').ignore();
    await tester.pumpAndSettle();

    final pay = find.text(l10n.payConfirmButton);
    await tester.ensureVisible(pay);
    await tester.pumpAndSettle();
    await tester.tap(pay);
    // Orqadagi tugma loading holatida (cheksiz spinner) — settle bo'lmaydi.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
    expect(tester.widget<OtpInput>(find.byType(OtpInput)).length, 4);

    await tester.enterText(
      find.descendant(
        of: find.byType(OtpInput),
        matching: find.byType(TextField),
      ),
      '1234',
    );
    await tester.pumpAndSettle();

    expect(find.byType(PaymentOtpSheet), findsNothing);
    expect(find.text(l10n.paySuccessTitle), findsOneWidget);

    await tester.tap(find.text(l10n.closeLabel));
    await tester.pumpAndSettle();
    expect(find.text('start-page'), findsOneWidget);
    expect(find.byType(PayPage), findsNothing);
    verify(() => payUtility(any())).called(1);
    expect(tester.takeException(), isNull);
    await drainFonts(tester);
  });
}
