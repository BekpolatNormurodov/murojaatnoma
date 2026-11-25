import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/home/presentation/pages/home_page.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/features/registration/presentation/pages/registration_page.dart';
import 'package:user_app/features/requests/presentation/pages/submit_request_page.dart';
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

  testWidgets('changed screens at 360x640: registration (with logout), home '
      'quick action, profile with registered name', (tester) async {
    useSmallScreen(tester);
    final docs = Directory.systemTemp.createTempSync('layout');
    addTearDown(() => docs.deleteSync(recursive: true));
    await configureTestApp(docs);
    final l10n = lookupAppLocalizations(const Locale('uz'));
    await tester.pumpWidget(const UserApp());
    final router = getIt<AppRouter>().config;
    final auth = getIt<AuthCubit>();

    await auth.verifyOtp('+998901111111', '000000');
    router.go('/register');
    await settle(tester);
    expect(find.byType(RegistrationPage), findsOneWidget);
    expect(find.text(l10n.logout), findsOneWidget);
    expect(tester.takeException(), isNull);

    await getIt<RegistrationRepository>().saveProfile(
      const CitizenProfile(
        fullName: 'Aliyev Bekzod',
        regionCode: 'toshkent_shahri',
      ),
    );
    auth
      ..markRegistered(fullName: 'Aliyev Bekzod')
      ..markFaceEnrolled()
      ..markPinSet();
    router.go('/home');
    await settle(tester);
    expect(find.text('Aliyev Bekzod'), findsOneWidget);
    expect(tester.takeException(), isNull);

    final complaint = find.text(l10n.quickActionComplaint);
    await tester.scrollUntilVisible(
      complaint,
      150,
      scrollable: find
          .descendant(
            of: find.byType(HomePage),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.ensureVisible(complaint);
    await settle(tester);
    await tester.tap(complaint);
    await settle(tester);
    expect(
      tester
          .widget<SubmitRequestPage>(find.byType(SubmitRequestPage))
          .initialKind
          .name,
      'shikoyat',
    );
    expect(tester.takeException(), isNull);

    router.go('/profile');
    await settle(tester);
    expect(find.text('Aliyev Bekzod'), findsOneWidget);
    expect(find.text('+998901111111'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await drainFonts(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    await getIt<NotificationsCubit>().close();
    await tester.pump(const Duration(seconds: 5));
    await drainFonts(tester);
    await getIt.reset();
  });
}
