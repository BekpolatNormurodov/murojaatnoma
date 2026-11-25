// Eng kichik telefon (360x640) + katta shrift (1.3): ekranlar haqiqiy router
// va uzun ma'lumot bilan ochiladi, hech biri "overflow" bermaydi.
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/requests/presentation/widgets/citizen_request_card.dart';
import 'package:user_app/injection.dart';

import '../screenshots/scenario_sources.dart';
import '../support/app_harness.dart';
import '../support/fonts.dart';
import '../support/small_screen.dart';

void main() {
  setUpAll(loadTestFonts);

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
  }

  Future<void> run(
    WidgetTester tester,
    Mode mode,
    Future<void> Function(AuthCubit auth) body,
  ) async {
    useSmallScreen(tester);
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final docs = Directory.systemTemp.createTempSync('large');
    addTearDown(() => docs.deleteSync(recursive: true));
    await configureTestApp(docs);
    useScenarioSources(mode);
    final auth = getIt<AuthCubit>();
    await tester.pumpWidget(const UserApp());
    await auth.verifyOtp('+998901234567', '000000');
    auth
      ..markRegistered(fullName: 'Aliyeva Nodira Baxtiyor qizi')
      ..markFaceEnrolled()
      ..markPinSet();

    await body(auth);

    await drainFonts(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    await getIt<NotificationsCubit>().close();
    await tester.pump(const Duration(seconds: 40));
    await drainFonts(tester);
    await getIt.reset();
  }

  testWidgets('filled screens fit', (tester) async {
    await run(tester, Mode.filled, (_) async {
      final router = getIt<AppRouter>().config;
      final routes = <String, Object?>{
        '/home': null,
        '/kommunalka': null,
        '/applications': null,
        '/applications/open': null,
        '/applications/submit': null,
        '/pay': demoUtility,
        '/payments-history/receipt': demoPayment,
        '/notifications': null,
        '/profile': null,
        '/reports': null,
      };
      for (final MapEntry(key: route, value: extra) in routes.entries) {
        router.go(route, extra: extra);
        await settle(tester);
        // Butun sahifani aylantirib chiqamiz (lazy ro'yxatlar ham quriladi).
        final scrollable = find.byWidgetPredicate(
          (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
        );
        if (scrollable.evaluate().isNotEmpty) {
          for (var i = 0; i < 6; i++) {
            await tester.drag(
              scrollable.last,
              const Offset(0, -400),
              warnIfMissed: false,
            );
            await tester.pump(const Duration(milliseconds: 300));
          }
        }
        expect(tester.takeException(), isNull, reason: route);
      }
    });
  });

  testWidgets('PIN unlock keeps "forgot PIN" on screen', (tester) async {
    await run(tester, Mode.filled, (auth) async {
      auth
        ..reset()
        ..markPinAlreadySet();
      await auth.verifyOtp('+998901234567', '000000');
      auth
        ..markRegistered()
        ..markFaceEnrolled()
        ..markPinAlreadySet();
      getIt<AppRouter>().config.go('/pin/unlock');
      await settle(tester);

      final forgot = find.byType(TextButton);
      expect(tester.getRect(forgot).bottom, lessThanOrEqualTo(640));
      expect(tester.takeException(), isNull);
    });
  });

  testWidgets('offline detail shows the network message, not "not found"', (
    tester,
  ) async {
    await run(tester, Mode.error, (_) async {
      getIt<AppRouter>().config.go('/applications/open');
      await settle(tester);

      final l10n = lookupAppLocalizations(const Locale('uz'));
      expect(find.textContaining("Internetga ulanib bo'lmadi"), findsOneWidget);
      expect(find.textContaining(l10n.requestNotFoundTitle), findsNothing);
    });
  });

  testWidgets('status filter applies and resets', (tester) async {
    await run(tester, Mode.filled, (_) async {
      getIt<AppRouter>().config.go('/applications');
      await settle(tester);
      final all = find.byType(CitizenRequestCard).evaluate().length;
      expect(all, greaterThan(1));

      Future<void> tapText(String text) async {
        await tester.tap(find.text(text).last);
        await settle(tester);
      }

      final l10n = lookupAppLocalizations(const Locale('uz'));
      await tester.tap(find.byIcon(IconsaxPlusLinear.filter));
      await settle(tester);
      await tapText(l10n.requestsFilterAll);
      await tapText(l10n.citizenRequestStatusJavobBerildi);
      await tapText("Qo'llash");
      expect(find.byType(CitizenRequestCard), findsOneWidget);

      await tester.tap(find.byIcon(IconsaxPlusLinear.filter));
      await settle(tester);
      await tapText('Tozalash');
      expect(find.byType(CitizenRequestCard).evaluate().length, all);
    });
  });
}
