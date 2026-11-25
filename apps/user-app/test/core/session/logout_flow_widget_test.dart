import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/auth/presentation/pages/phone_input_page.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/home/presentation/pages/home_page.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/payments/presentation/bloc/utilities_cubit.dart';
import 'package:user_app/features/profile/presentation/profile_page.dart';
import 'package:user_app/injection.dart';

import '../../support/app_harness.dart';
import '../../support/fonts.dart';
import '../../support/small_screen.dart';

void main() {
  late Directory docs;
  late FakeAuthRepository repository;

  setUpAll(loadTestFonts);

  setUp(() => docs = Directory.systemTemp.createTempSync('logout_flow'));

  tearDown(() => docs.deleteSync(recursive: true));

  // Cheksiz animatsiyalar bor — `pumpAndSettle` o'rniga.
  Future<void> settle(WidgetTester tester) async {
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
  }

  Future<void> signIn(WidgetTester tester, String phone) async {
    final auth = getIt<AuthCubit>();
    await auth.verifyOtp(phone, '000000');
    auth
      ..markRegistered()
      ..markFaceEnrolled()
      ..markPinSet();
    await tester.pump();
    getIt<AppRouter>().config.go('/home');
    await settle(tester);
  }

  testWidgets('profile logout (cancel, then confirm) and a second citizen '
      'signs in with working Home and Kommunalka', (tester) async {
    useSmallScreen(tester);
    repository = await configureTestApp(docs);
    final l10n = lookupAppLocalizations(const Locale('uz'));
    await tester.pumpWidget(const UserApp());
    final router = getIt<AppRouter>().config;

    await signIn(tester, '+998901111111');
    expect(find.byType(HomePage), findsOneWidget);
    router.go('/kommunalka');
    await settle(tester);
    expect(getIt<UtilitiesCubit>().state, isA<UtilitiesLoaded>());

    Future<void> tapLogout() async {
      router.go('/profile');
      await settle(tester);
      await tester.scrollUntilVisible(find.text(l10n.logout), 200);
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.text(l10n.logout));
      await settle(tester);
    }

    // Bekor qilish dialogni yopadi, profil joyida qoladi.
    await tapLogout();
    await tester.tap(find.text(l10n.cancel));
    await settle(tester);
    expect(find.text(l10n.logoutConfirmTitle), findsNothing);
    expect(find.byType(ProfilePage), findsOneWidget);
    expect(repository.logouts, 0);
    expect(tester.takeException(), isNull);

    await tapLogout();
    await tester.tap(find.text(l10n.logoutConfirmCta));
    await settle(tester);
    expect(repository.logouts, 1);
    expect(find.byType(PhoneInputPage), findsOneWidget);
    expect(getIt<HomeCubit>().isClosed, isFalse);
    expect(getIt<HomeCubit>().state, const HomeLoading());
    expect(tester.takeException(), isNull);

    await signIn(tester, '+998902222222');
    expect(find.byType(HomePage), findsOneWidget);
    expect(getIt<HomeCubit>().state, isA<HomeLoaded>());
    router.go('/kommunalka');
    await settle(tester);
    expect(getIt<UtilitiesCubit>().state, isA<UtilitiesLoaded>());
    // To'lovdan keyingi qayta yuklash ham ishlaydi (yopiq cubit emas).
    unawaited(getIt<HomeCubit>().load());
    await settle(tester);
    expect(tester.takeException(), isNull);

    await drainFonts(tester);
    await tester.pumpWidget(const SizedBox.shrink());
    await getIt<NotificationsCubit>().close();
    await tester.pump(const Duration(seconds: 5));
    await drainFonts(tester);
    await getIt.reset();
  });
}
