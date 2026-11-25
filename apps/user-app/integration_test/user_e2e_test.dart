// End-to-end run of the citizen app on a simulator against a LOCAL backend.
//
//   flutter test integration_test/user_e2e_test.dart -d <simulator> \
//     --dart-define=API_BASE_URL=http://127.0.0.1:3555 \
//     --dart-define=E2E_ADMIN_USER=... --dart-define=E2E_ADMIN_PASSWORD=... \
//     --dart-define=E2E_FIXTURES=/path/with/test/files
//
// The backend must run with OTP_DEMO_CODE=111111.
// ignore_for_file: depend_on_referenced_packages, lines_longer_than_80_chars
// ignore_for_file: deprecated_member_use
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:integration_test/integration_test.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/injection.dart';
import 'package:user_app/main.dart' as app;

import 'support/e2e.dart';
import 'support/fakes.dart';

const otp = String.fromEnvironment('E2E_OTP', defaultValue: '111111');

class Citizen {
  Citizen(this.name) : digits = '90${Random().nextInt(8999999) + 1000000}';
  final String name;
  final String digits;
  String get phone => '+998$digits';
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('citizen app end to end', (tester) async {
    requireLocalBackend();
    HttpOverrides.global = LocalOnlyHttpOverrides();
    ImagePickerPlatform.instance = FakeImagePicker();
    PermissionHandlerPlatform.instance = CameraDeniedPermissions(
      PermissionHandlerPlatform.instance,
    );
    await const FlutterSecureStorage().deleteAll();
    await (await SharedPreferences.getInstance()).clear();
    await seedFontCache();

    final admin = await adminToken();
    final a = Citizen('Anvar Sinov Karimovich');
    final b = Citizen('Bahora Tekshiruv Aliyevna');

    final e = E2E(tester)..captureFlutterErrors();
    // Same flags as `main_prod.dart`: payments are mock (no backend for them),
    // everything else talks to the API.
    AppConfig.init(flavor: AppFlavor.prod, useMock: true, apiBaseUrl: apiBase);
    await app.bootstrap(systemServices: false);
    await e.wait(1000);

    Finder button(String label) => find.widgetWithText(AppButton, label);

    e.recover = () async {
      if (!getIt<AuthCubit>().state.pinUnlocked) return;
      getIt<AppRouter>().config.routerDelegate.navigatorKey.currentState
          ?.popUntil((route) => route is! PopupRoute);
      getIt<AppRouter>().config.go('/home');
      await e.wait(1500);
    };

    Future<String> token() async =>
        (await SharedPreferences.getInstance()).getString('auth_token')!;

    Future<List<dynamic>> myApplications() async {
      final r = await apiOk('GET', '/applications', token: await token());
      return (r is Map ? r['data'] ?? r['items'] : r) as List<dynamic>;
    }

    Future<void> enterPhone(Citizen c) async {
      await e.see(button('Kodni yuborish'), seconds: 30);
      await e.wait(1200);
      await e.type(find.byType(EditableText).first, c.digits);
      e.hideKeyboard();
      await e.wait();
      await e.tap(button('Kodni yuborish'));
      await e.see(find.text('Kodni kiriting'), seconds: 20);
      await e.wait(800);
    }

    Future<void> enterOtp(String code) async {
      await e.type(find.byType(EditableText).last, code);
    }

    Future<void> pin(String code) async {
      for (final d in code.split('')) {
        await e.tap(find.text(d).last);
      }
      await e.wait(800);
    }

    /// Registration → face (placed directly, no camera on a simulator) → PIN.
    Future<void> onboard(Citizen c, {required String shots}) async {
      await e.see(button('Davom etish'), seconds: 30);
      await e.wait(800);
      expect(
        tester
            .widget<EditableText>(find.byType(EditableText).first)
            .controller
            .text,
        isEmpty,
      );
      await e.shot('${shots}_register');
      await e.type(find.byType(EditableText).first, c.name);
      e.hideKeyboard();
      await e.wait();
      await e.tap(button('Davom etish'));
      await e.see(find.byTooltip('Chiqish'), seconds: 20);
      await e.wait(3000);
      debugPrint('E2E_INFO face onboarding: ${e.visibleTexts()}');
      await e.shot('${shots}_face_onboarding');
      final auth = getIt<AuthCubit>();
      await const FlutterSecureStorage().write(
        key: 'face_template',
        value: jsonEncode({
          'embedding': List.filled(192, 0.07),
          'enrolled_at': DateTime.now().toIso8601String(),
          'owner_id': auth.state.session!.userId,
        }),
      );
      auth.markFaceEnrolled();
      await e.see(find.text("PIN kod o'rnating"), seconds: 20);
      await e.wait(800);
      await pin('1234');
      await e.see(find.text('PIN kodni tasdiqlang'));
      await e.wait(800);
      await pin('1234');
      await e.see(find.text('Bosh sahifa'), seconds: 30);
      await e.wait(2000);
    }

    Future<void> openTab(String label) async {
      await e.tap(find.text(label).last);
      await e.wait(1200);
    }

    Future<void> back() async {
      await e.tap(find.byType(AppBackButton).last);
      await e.wait(800);
    }

    Future<void> logout() async {
      await openTab('Profil');
      await e.reveal(button('Chiqish'));
      await e.tap(button('Chiqish'));
      await e.see(button('Ha, chiqish'));
      await e.tap(button('Ha, chiqish'));
      await e.see(button('Kodni yuborish'), seconds: 30);
    }

    await e.step('login page', () async {
      await e.see(button('Kodni yuborish'), seconds: 40);
      await e.shot('u01_login');
    });

    await e.step('wrong OTP shows an error, correct OTP signs in', () async {
      await enterPhone(a);
      await enterOtp('999999');
      await e.wait(2500);
      debugPrint('E2E_INFO after wrong otp: ${e.visibleTexts()}');
      await e.shot('u02_wrong_otp');
      expect(find.text('Kodni kiriting'), findsOneWidget);
      await e.wait(3000);
      await enterOtp('');
      await enterOtp(otp);
    });

    await e.step('onboarding A', () async {
      await onboard(a, shots: 'u03');
      await e.shot('u04_home_a');
      expect(find.textContaining('Anvar'), findsWidgets);
    });

    const title = 'E2E chiroq ishlamayapti';
    const body =
        'Asaka mahallasida kocha chirogi uch kundan beri ishlamayapti.';

    await e.step('submit a request with a photo', () async {
      await openTab('Bosh sahifa');
      await e.tap(find.text('Ariza').first);
      await e.see(find.byType(AppTextField));
      await e.wait(800);
      await e.shot('u05_submit_empty');
      await e.type(find.byType(EditableText).first, title);
      e.hideKeyboard();
      await e.tap(find.text('Kategoriyani tanlang'));
      await e.tap(find.text("Yo'l xo'jaligi").last);
      final description = find.descendant(
        of: find.widgetWithText(
          AppTextField,
          'Murojaat tavsifini batafsil yozing',
        ),
        matching: find.byType(EditableText),
      );
      await e.reveal(find.text('Rasm'));
      await e.type(
        description.evaluate().isNotEmpty
            ? description
            : find.byType(EditableText).last,
        body,
      );
      e.hideKeyboard();
      await e.wait();
      await e.reveal(find.text('Rasm'));
      await e.tap(find.text('Rasm'));
      await e.tap(find.text('Galereya'));
      await e.see(find.textContaining('photo.jpg'));
      await e.reveal(button('Yuborish'));
      await e.shot('u06_submit_filled');
      await e.tap(button('Yuborish'));
      await e.see(find.text('Murojaat yuborildi'), seconds: 40);
      await e.shot('u07_submit_success');
      await e.tap(button('Yopish'));
      await e.gone(find.text('Murojaat yuborildi'));
      final list = await myApplications();
      debugPrint('E2E_INFO applications=$list');
      expect(list.length, 1);
    });

    late String applicationId;
    await e.step('request appears in list and detail', () async {
      final item = (await myApplications()).single as Map<String, dynamic>;
      applicationId = item['id'] as String;
      final files = await apiOk(
        'GET',
        '/applications/$applicationId/attachments',
        token: await token(),
      );
      debugPrint('E2E_INFO attachments=$files');
      expect((files as List).length, 1);
      await openTab('Arizalar');
      await e.see(find.textContaining(title));
      await e.shot('u08_list');
      await e.tap(find.textContaining(title).first);
      await e.see(find.textContaining('Asaka mahallasida'));
      await e.wait(2500);
      await e.shot('u09_detail');
      await e.reveal(
        find.textContaining('photo.jpg').evaluate().isNotEmpty
            ? find.textContaining('photo.jpg')
            : find.byType(Image),
      );
      await e.shot('u10_detail_attachment');
    });

    await e.step('send a message in the request', () async {
      const text = 'Qoshimcha: ustun raqami 17';
      await e.reveal(button('Yuborish'));
      await e.type(find.byType(EditableText).last, text);
      e.hideKeyboard();
      await e.wait();
      await e.reveal(button('Yuborish'));
      await e.tap(button('Yuborish'));
      await e.see(find.text(text), seconds: 20);
      await e.wait(1500);
      final messages = await apiOk(
        'GET',
        '/applications/$applicationId/messages',
        token: await token(),
      );
      expect('$messages', contains(text));
    });

    const reply = 'Elektrik yuborildi, chiroq tamirlandi.';
    await e.step('staff reply and resolve show up on refresh', () async {
      await apiOk(
        'POST',
        '/applications/$applicationId/reply',
        token: admin,
        body: {'text': reply, 'resolve': true},
      );
      await back();
      await e.wait(800);
      await e.tap(find.textContaining(title).first);
      await e.wait(2500);
      await e.reveal(find.textContaining('chiroq tamirlandi'));
      // The reply is stamped in the phone's local time, not in server UTC.
      final thread =
          (await apiOk(
                'GET',
                '/applications/$applicationId/messages',
                token: await token(),
              ))
              as List;
      final sent = DateTime.parse(
        (thread.last as Map)['createdAt'] as String,
      ).toLocal();
      final hhmm =
          '${sent.hour.toString().padLeft(2, '0')}:${sent.minute.toString().padLeft(2, '0')}';
      expect(find.textContaining(', $hhmm'), findsWidgets);
      await e.shot('u11_detail_reply');
      await back();
    });

    await e.step('notifications', () async {
      final list = await apiOk(
        'GET',
        '/notifications/citizen',
        token: await token(),
      );
      debugPrint('E2E_INFO notifications=$list');
      expect(list as List, isNotEmpty);
      await openTab('Bosh sahifa');
      await e.reveal(find.byIcon(AppIcons.notification).first);
      await e.tap(find.byIcon(AppIcons.notification).first);
      await e.see(find.text((list.first as Map)['title'] as String));
      await e.shot('u12_notifications');
      await back();
    });

    await e.step('profile and logout cancel', () async {
      await openTab('Profil');
      await e.wait(1500);
      await e.shot('u13_profile');
      await e.reveal(button('Chiqish'));
      await e.tap(button('Chiqish'));
      await e.shot('u14_logout_confirm');
      await e.tap(button('Bekor qilish'));
      await e.wait(1000);
      expect(button('Chiqish'), findsOneWidget);
    });

    await e.step('logout A clears the session', () async {
      await logout();
      await e.shot('u15_after_logout');
      final prefs = await SharedPreferences.getInstance();
      debugPrint('E2E_INFO prefs after logout=${prefs.getKeys()}');
      expect(prefs.getString('auth_token'), isNull);
      expect(prefs.getString('auth_refresh_token'), isNull);
      expect(prefs.getString('user_session'), isNull);
      expect(
        prefs.getKeys().where((k) => k.startsWith('requests_cache')),
        isEmpty,
      );
    });

    await e.step('login B sees nothing from A', () async {
      await enterPhone(b);
      await enterOtp(otp);
      await onboard(b, shots: 'u16');
      expect(find.textContaining('Anvar'), findsNothing);
      await e.shot('u17_home_b');
      await openTab('Arizalar');
      await e.wait(2000);
      expect(find.textContaining(title), findsNothing);
      await e.shot('u18_list_b_empty');
      await openTab('Bosh sahifa');
      await e.tap(find.byIcon(AppIcons.notification).first);
      await e.wait(2000);
      expect(find.textContaining('tamirlandi'), findsNothing);
      expect(
        (await apiOk('GET', '/notifications/citizen', token: await token()))
            as List,
        isEmpty,
      );
      await back();
      await openTab('Profil');
      await e.see(find.textContaining('Bahora'));
      expect(find.textContaining('Anvar'), findsNothing);
      final foreign = await api(
        'GET',
        '/applications/$applicationId',
        token: await token(),
      );
      expect(foreign.status, 403);
    });

    await e.step('rejected session goes cleanly to login', () async {
      await openTab('Profil');
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', 'expired.invalid.token');
      await openTab('Bosh sahifa');
      await e.tap(find.byIcon(AppIcons.notification).first);
      await e.see(button('Kodni yuborish'), seconds: 30);
      await e.wait(1500);
      await e.shot('u19_session_expired');
      expect(prefs.getString('user_session'), isNull);
    });

    await e.step(
      'same citizen signs in again: no re-registration, requests back',
      () async {
        await enterPhone(b);
        await enterOtp(otp);
        await e.see(find.text('PIN kodni kiriting'), seconds: 30);
        await e.wait(800);
        await pin('1234');
        await e.see(find.text('Bosh sahifa'), seconds: 30);
        await logout();
      },
    );

    await e.step(
      'A again after B: A data from server, onboarding anew',
      () async {
        await enterPhone(a);
        await enterOtp(otp);
        // Another citizen used the phone, so local onboarding data was wiped.
        await onboard(a, shots: 'u20');
        await openTab('Arizalar');
        await e.see(find.textContaining(title));
        await logout();
      },
    );

    e
      ..finish()
      ..restoreFlutterErrors();
    expect(e.failures, isEmpty, reason: e.failures.join('\n'));
    expect(e.uiErrors, isEmpty, reason: e.uiErrors.join('\n'));
  }, timeout: const Timeout(Duration(minutes: 25)));
}
