import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/auth/presentation/pages/phone_input_page.dart';
import 'package:user_app/features/face/presentation/pages/face_enroll_page.dart';
import 'package:user_app/features/home/presentation/pages/home_page.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/pin/presentation/pages/pin_set_page.dart';
import 'package:user_app/injection.dart';

import '../../support/app_harness.dart';
import '../../support/fonts.dart';
import '../../support/small_screen.dart';

void main() {
  setUpAll(loadTestFonts);

  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
  }

  testWidgets('face onboarding and PIN setup can be left by logging out; '
      'PIN change from the profile has a back button instead (360x640)', (
    tester,
  ) async {
    useSmallScreen(tester);
    final docs = Directory.systemTemp.createTempSync('onboarding_logout');
    addTearDown(() => docs.deleteSync(recursive: true));
    final repository = await configureTestApp(docs);
    // Kamera ruxsati rad etilgan — eng "tiqilib qoladigan" holat.
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('flutter.baseflow.com/permissions/methods'),
      (call) async => call.method == 'requestPermissions'
          ? {for (final p in call.arguments as List) p: 0}
          : 0,
    );
    final l10n = lookupAppLocalizations(const Locale('uz'));
    await tester.pumpWidget(const UserApp());
    final router = getIt<AppRouter>().config;
    final auth = getIt<AuthCubit>();

    Future<void> confirm() async {
      await settle(tester);
      await tester.tap(find.text(l10n.logoutConfirmCta));
      await settle(tester);
      expect(find.byType(PhoneInputPage), findsOneWidget);
      expect(auth.state.isAuthenticated, isFalse);
      expect(tester.takeException(), isNull);
    }

    await auth.verifyOtp('+998901111111', '000000');
    auth.markRegistered();
    router.go('/face/onboarding');
    await settle(tester);
    expect(find.byType(FaceEnrollPage), findsOneWidget);
    expect(find.text(l10n.facePermissionTitle), findsOneWidget);
    await tester.tap(find.byTooltip(l10n.logout));
    await confirm();

    await auth.verifyOtp('+998901111111', '000000');
    auth
      ..markRegistered()
      ..markFaceEnrolled();
    router.go('/pin/set');
    await settle(tester);
    expect(find.byType(PinSetPage), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text(l10n.logout));
    await confirm();
    expect(repository.logouts, 2);

    await auth.verifyOtp('+998901111111', '000000');
    auth
      ..markRegistered()
      ..markFaceEnrolled()
      ..markPinSet();
    router.go('/home');
    await settle(tester);
    expect(find.byType(HomePage), findsOneWidget);
    router.push('/pin/set').ignore();
    await settle(tester);
    expect(find.text(l10n.logout), findsNothing);
    await tester.tap(find.byType(AppBackButton));
    await settle(tester);
    expect(find.byType(HomePage), findsOneWidget);
    expect(find.byType(PinSetPage), findsNothing);

    await drainFonts(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    await getIt<NotificationsCubit>().close();
    await tester.pump(const Duration(seconds: 5));
    await drainFonts(tester);
    await getIt.reset();
  });
}
