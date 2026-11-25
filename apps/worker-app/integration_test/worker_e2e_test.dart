// ignore_for_file: lines_longer_than_80_chars, deprecated_member_use
// End-to-end run of the worker app on a simulator against a LOCAL backend.
//
//   flutter test integration_test/worker_e2e_test.dart -d <simulator> \
//     --dart-define=API_BASE_URL=http://127.0.0.1:3555 \
//     --dart-define=E2E_ADMIN_USER=... --dart-define=E2E_ADMIN_PASSWORD=... \
//     --dart-define=E2E_FIXTURES=/path/with/test/files
//
// Before running: set the simulator location inside mahalla 1090106
// (41.315432,69.300162) and grant location + microphone to the app.
// ignore_for_file: depend_on_referenced_packages
import 'dart:io';
import 'dart:math';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker_platform_interface/image_picker_platform_interface.dart';
import 'package:integration_test/integration_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:record_platform_interface/record_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/app/router/app_router.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/injection.dart';
import 'package:worker_app/main.dart' as app;

import 'support/e2e.dart';
import 'support/fakes.dart';

const m1 = '1090106'; // Asaka — the simulator stands here
const m2 = '1090095'; // Mirzakalon Ismoiliy
const m3 = '1090101'; // Oqqo'rg'on
const m4 = '1090102'; // Olimlar

const points = {
  m1: LatLng(41.315432, 69.300162),
  m2: LatLng(41.317667, 69.307144),
  m3: LatLng(41.327874, 69.301117),
  m4: LatLng(41.342147, 69.340518),
};

String ymd(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

String clock(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:'
    '${d.minute.toString().padLeft(2, '0')}';

class Worker {
  Worker(this.name, this.username, this.password);
  final String name;
  final String username;
  final String password;
  late final String id;
  late String token;
}

Future<Worker> createWorker(
  String admin,
  String name,
  String username,
  List<String> zones,
) async {
  final w = Worker(
    name,
    username,
    'E2e-pass-${Random().nextInt(900000) + 100000}',
  );
  final digits = (Random().nextInt(8999999) + 1000000).toString();
  await apiOk(
    'POST',
    '/oversight/employee',
    token: admin,
    body: {
      'fullName': name,
      'position': 'Mahalla xodimi',
      'username': w.username,
      'password': w.password,
      'phone': '+99890$digits',
      'assignedMahallaCodes': zones,
      'workStartTime': '00:00',
      'workEndTime': '23:59',
    },
  );
  final login = await apiOk(
    'POST',
    '/auth/employee/login',
    body: {'username': w.username, 'password': w.password},
  );
  w.token = (login as Map)['accessToken'] as String;
  final me = await apiOk('GET', '/auth/me', token: w.token);
  w.id = (me as Map)['id'] as String;
  return w;
}

/// 7 past days: 09:00–10:00 in [m1] (inside), 10:05–10:30 in [m3] (outside).
Future<void> seedTrack(Worker w) async {
  final now = DateTime.now();
  for (var back = 1; back <= 7; back++) {
    final day = DateTime(now.year, now.month, now.day - back);
    final items = <Map<String, Object>>[];
    void add(int minute, String code) => items.add({
      'latitude': points[code]!.latitude,
      'longitude': points[code]!.longitude,
      'accuracy': 10,
      'recordedAt': day
          .add(Duration(minutes: minute))
          .toUtc()
          .toIso8601String(),
    });
    for (var m = 9 * 60; m <= 10 * 60; m += 5) {
      add(m, m1);
    }
    for (var m = 10 * 60 + 5; m <= 10 * 60 + 30; m += 5) {
      add(m, m3);
    }
    await apiOk(
      'POST',
      '/locations/batch',
      token: w.token,
      body: {'items': items},
    );
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('worker app end to end', (tester) async {
    requireLocalBackend();
    HttpOverrides.global = LocalOnlyHttpOverrides();
    RecordPlatform.instance = FakeRecordPlatform();
    final files = FakeFilePicker();
    FilePicker.platform = files;
    PermissionHandlerPlatform.instance = CameraDeniedPermissions(
      PermissionHandlerPlatform.instance,
    );
    ImagePickerPlatform.instance = FakeImagePicker();
    await const FlutterSecureStorage().deleteAll();
    await (await SharedPreferences.getInstance()).clear();
    await seedFontCache();

    // ---- server fixtures ----
    final admin = await adminToken();
    await apiOk(
      'PATCH',
      '/settings/attendance',
      token: admin,
      body: {'faceRequired': false},
    );
    final tag = DateTime.now().millisecondsSinceEpoch.toString().substring(6);
    final a = await createWorker(admin, 'Alisher Sinovov $tag', 'e2e_a_$tag', [
      m1,
    ]);
    final b = await createWorker(admin, 'Barno Tekshirova $tag', 'e2e_b_$tag', [
      m4,
    ]);
    await seedTrack(a);
    const bSecret = 'B xodimning shaxsiy hisoboti';
    await apiOk(
      'POST',
      '/daily-reports',
      token: b.token,
      body: {'text': bSecret},
    );

    final e = E2E(tester)..captureFlutterErrors();
    AppConfig.init(flavor: AppFlavor.prod, useMock: false, apiBaseUrl: apiBase);
    await app.bootstrap(systemServices: false);
    await e.wait(1000);

    Finder button(String label) => find.widgetWithText(AppButton, label);

    e.recover = () async {
      if (!getIt<AuthCubit>().state.isAuthenticated) return;
      getIt<AppRouter>().config.routerDelegate.navigatorKey.currentState
          ?.popUntil((route) => route is! PopupRoute);
      getIt<AppRouter>().config.go('/home');
      await e.wait(1500);
    };

    Future<void> login(Worker w) async {
      await e.see(button('Kirish'), seconds: 30);
      await e.wait(1200);
      final fields = find.byType(EditableText);
      await e.type(fields.at(0), w.username);
      await e.type(fields.at(1), w.password);
      e.hideKeyboard();
      await e.wait(500);
      await e.tap(button('Kirish'));
      await e.see(find.text('Kunlik hisobot'), seconds: 30);
      await e.see(find.textContaining(w.name.split(' ').first));
    }

    Future<void> openTab(String label) async {
      await e.tap(find.text(label).last);
      await e.wait(800);
    }

    Future<void> back() async {
      await e.tap(find.byType(AppBackButton).last);
      await e.wait(600);
    }

    Future<void> openReports() async {
      await openTab('Bosh sahifa');
      final card = find.byKey(const Key('daily_report_card'));
      await e.reveal(card);
      await e.tap(card);
      await e.see(find.byKey(const Key('reports_compose_fab')));
      await e.wait(1500);
    }

    Future<Map<String, dynamic>> myAttendance(Worker w) async =>
        (await apiOk('GET', '/attendance/me', token: w.token))
            as Map<String, dynamic>;

    Future<List<dynamic>> myReports(Worker w) async =>
        (await apiOk('GET', '/daily-reports/my?days=31', token: w.token))
            as List<dynamic>;

    await e.step('permissions', () async {
      final mic = await Permission.microphone.status;
      final cam = await Permission.camera.status;
      debugPrint('E2E_INFO microphone=$mic camera=$cam');
      expect(mic.isGranted, isTrue, reason: 'microphone permission: $mic');
    });

    await e.step('login page', () async {
      await e.see(button('Kirish'), seconds: 40);
      await e.shot('w01_login');
    });

    await e.step('wrong password shows an error and stays on login', () async {
      await e.wait(800);
      final fields = find.byType(EditableText);
      await e.type(fields.at(0), a.username);
      await e.type(fields.at(1), 'notogri-parol');
      e.hideKeyboard();
      await e.wait();
      await e.tap(button('Kirish'));
      await e.see(find.textContaining('Login yoki parol xato'));
      await e.wait(4500);
    });

    await e.step('login A, home without face scan', () async {
      await login(a);
      await e.see(button('Keldim — joylashuv bilan'));
      await e.wait(2500);
      await e.shot('w02_home_face_off');
    });

    await e.step('check-in by location (face off)', () async {
      await e.tap(button('Keldim — joylashuv bilan'));
      await e.see(button('Ishdan chiqish'), seconds: 40);
      final me = await myAttendance(a);
      debugPrint('E2E_INFO attendance/me=$me');
      final today =
          (await apiOk('GET', '/attendance/today', token: admin)) as Map;
      final row = (today['roster'] as List)
          .cast<Map<String, dynamic>>()
          .firstWhere((r) => r['employeeId'] == a.id);
      expect(row['checkIn'], isNotNull);
      expect((row['checkIn'] as Map)['faceChecked'], isFalse);
      await e.shot('w03_checked_in');
    });

    await e.step('live location reaches the server', () async {
      Map<dynamic, dynamic>? latest;
      for (var i = 0; i < 20; i++) {
        final r = await apiOk('GET', '/locations/me', token: a.token);
        latest = r as Map?;
        if ('$latest'.contains(m1)) break;
        await e.wait(1000);
      }
      debugPrint('E2E_INFO locations/me=$latest');
      expect('$latest', contains(m1));
    });

    await e.step(
      'face switch ON: app asks for enrollment, with a way out',
      () async {
        await apiOk(
          'PATCH',
          '/settings/attendance',
          token: admin,
          body: {'faceRequired': true},
        );
        final rejected = await api(
          'POST',
          '/attendance/check-in',
          token: b.token,
          body: {
            'latitude': points[m4]!.latitude,
            'longitude': points[m4]!.longitude,
          },
        );
        debugPrint(
          'E2E_INFO check-in without face while required: ${rejected.status} ${rejected.body}',
        );
        final bToday =
            (await apiOk('GET', '/attendance/today', token: admin)) as Map;
        final bRow = (bToday['roster'] as List)
            .cast<Map<String, dynamic>>()
            .firstWhere((r) => r['employeeId'] == b.id);
        expect(bRow['checkIn'], isNull, reason: 'face-less check-in accepted');
        await openTab('Bosh sahifa');
        await e.resumeApp();
        await e.gone(find.byKey(const Key('daily_report_card')));
        await e.wait(2500);
        debugPrint('E2E_INFO enroll screen: ${e.visibleTexts()}');
        await e.shot('w04_face_required_enroll');
        expect(
          find.textContaining('Chiqish').evaluate().isNotEmpty ||
              find.byTooltip('Chiqish').evaluate().isNotEmpty,
          isTrue,
          reason: 'no logout on the forced enrollment screen',
        );
      },
    );

    await e.step('face switch OFF again: app returns home', () async {
      await apiOk(
        'PATCH',
        '/settings/attendance',
        token: admin,
        body: {'faceRequired': false},
      );
      await e.resumeApp();
      await e.see(find.byKey(const Key('daily_report_card')), seconds: 30);
    });

    /// Which of the known mahallas are painted as the assigned work zone.
    Set<String> paintedZones() {
      final layers = find.byType(PolygonLayer).evaluate();
      final polygons = [
        for (final l in layers) ...(l.widget as PolygonLayer).polygons,
      ].where((p) => p.borderStrokeWidth == 2.2).toList();
      bool contains(List<LatLng> ring, LatLng p) {
        var inside = false;
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          final yi = ring[i].latitude, xi = ring[i].longitude;
          final yj = ring[j].latitude, xj = ring[j].longitude;
          if ((yi > p.latitude) != (yj > p.latitude) &&
              p.longitude < (xj - xi) * (p.latitude - yi) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
        return inside;
      }

      return {
        for (final entry in points.entries)
          if (polygons.any((p) => contains(p.points, entry.value))) entry.key,
      };
    }

    await e.step('map shows the assigned zone', () async {
      await openTab('Xarita');
      await e.until(
        () => paintedZones().contains(m1),
        seconds: 30,
        what: 'zone M1',
      );
      expect(paintedZones(), {m1});
      // The employee stands still: the current mahalla must still be known.
      await e.see(find.text('Asaka mahallasi'), seconds: 30);
      await e.wait(2000);
      await e.shot('w05_map_zone_m1');
    });

    await e.step(
      'admin changes zones, app reflects it without relogin',
      () async {
        await apiOk(
          'PATCH',
          '/oversight/employee/${a.id}',
          token: admin,
          body: {
            'fullName': a.name,
            'position': 'Mahalla xodimi',
            'assignedMahallaCodes': [m2, m3],
          },
        );
        await e.resumeApp();
        await e.until(
          () => paintedZones().containsAll({m2, m3}),
          seconds: 30,
          what: 'zones M2+M3 (painted: ${paintedZones()})',
        );
        expect(paintedZones(), {m2, m3});
        final server = await apiOk('GET', '/locations/me', token: a.token);
        expect('$server', allOf(contains(m2), contains(m3)));
        await e.wait(2000);
        debugPrint('E2E_INFO map texts: ${e.visibleTexts()}');
        await e.shot('w06_map_zone_changed');
      },
    );

    await e.step('personal info shows the new zone count', () async {
      await openTab('Profil');
      await e.shot('w07_profile');
      await e.reveal(find.text("Shaxsiy ma'lumotlar"));
      await e.tap(find.text("Shaxsiy ma'lumotlar"));
      await e.see(find.text('2 ta mahalla'));
      await e.shot('w08_personal_info');
      await back();
    });

    Future<void> compose(String text) async {
      await e.tap(find.byKey(const Key('reports_compose_fab')));
      await e.see(find.byKey(const Key('report_send_button')));
      await e.type(
        find.descendant(
          of: find.byKey(const Key('report_text_field')),
          matching: find.byType(EditableText),
        ),
        text,
      );
      e.hideKeyboard();
      await e.wait();
    }

    Future<void> send() async {
      await e.until(
        () {
          final w = find.byKey(const Key('report_send_button')).evaluate();
          return w.isNotEmpty &&
              (w.first.widget as AppButton).onPressed != null;
        },
        seconds: 40,
        what: 'send button enabled (uploads finished)',
      );
      await e.tap(find.byKey(const Key('report_send_button')));
      await e.see(find.byKey(const Key('reports_compose_fab')), seconds: 40);
      await e.wait(4500);
    }

    await e.step('text report', () async {
      await openReports();
      await e.shot('w09_reports_empty');
      await compose('E2E matnli hisobot: Asaka mahallasida 12 xonadon');
      await send();
      await e.see(find.textContaining('E2E matnli hisobot'));
      expect((await myReports(a)).length, 1);
    });

    Map<String, dynamic> reportWith(List<dynamic> list, String text) => list
        .cast<Map<String, dynamic>>()
        .firstWhere((r) => '${r['text']}'.startsWith(text));

    Future<void> checkDownload(Map<String, dynamic> attachment) async {
      final client = HttpClient();
      final res = await (await client.getUrl(
        Uri.parse(attachment['url'] as String),
      )).close();
      final bytes = await res.fold<int>(0, (n, c) => n + c.length);
      client.close(force: true);
      expect(res.statusCode, 200);
      expect(bytes, greaterThan(100));
    }

    await e.step('document report', () async {
      await compose('E2E hujjatli hisobot');
      await e.tap(find.text('Hujjat'));
      await e.see(find.textContaining('Dalolatnoma'));
      await e.shot('w10_compose_document');
      await send();
      final r = reportWith(await myReports(a), 'E2E hujjatli');
      final att = (r['attachments'] as List).single as Map<String, dynamic>;
      debugPrint('E2E_INFO document attachment=$att');
      expect(att['kind'], 'file');
      expect(att['fileName'], files.fileName);
      await checkDownload(att);
    });

    await e.step(
      'voice report (test file through the recorder sheet)',
      () async {
        await compose('E2E ovozli hisobot');
        await e.tap(find.text('Ovoz'));
        final record = find.byWidgetPredicate(
          (w) => '${w.runtimeType}' == '_RecordButton',
        );
        await e.tap(record);
        await e.wait(2000);
        await e.tap(record);
        await e.see(button('Biriktirish'));
        await e.shot('w11_voice_sheet');
        await e.tap(button('Biriktirish'));
        await e.wait(1000);
        await e.shot('w12_compose_voice');
        await send();
        final r = reportWith(await myReports(a), 'E2E ovozli');
        final att = (r['attachments'] as List).single as Map<String, dynamic>;
        debugPrint('E2E_INFO voice attachment=$att');
        expect(att['kind'], 'voice');
        await checkDownload(att);
      },
    );

    final weekAgo = () {
      final n = DateTime.now();
      return ymd(DateTime(n.year, n.month, n.day - 7));
    }();

    await e.step(
      'video report for 7 days back (test file via gallery)',
      () async {
        await compose('E2E video hisobot yetti kun oldin');
        final chip = find.byKey(ValueKey('day_$weekAgo'));
        await e.see(chip);
        await tester.ensureVisible(chip);
        await e.wait();
        await e.tap(chip);
        await e.tap(find.text('Video'));
        await e.tap(find.text('Galereya'));
        await e.see(find.textContaining('video.mp4'));
        await send();
        final r = reportWith(await myReports(a), 'E2E video');
        debugPrint('E2E_INFO video report=$r');
        expect(r['day'], weekAgo);
        final att = (r['attachments'] as List).single as Map<String, dynamic>;
        expect(att['kind'], 'video');
        await checkDownload(att);
      },
    );

    await e.step('photo report', () async {
      await compose('E2E rasmli hisobot');
      await e.tap(find.text('Rasm'));
      await e.tap(find.text('Galereya'));
      await e.see(find.textContaining('photo.jpg'));
      await send();
      final r = reportWith(await myReports(a), 'E2E rasmli');
      final att = (r['attachments'] as List).single as Map<String, dynamic>;
      expect(att['kind'], 'image');
      await checkDownload(att);
      await e.shot('w13_reports_list');
    });

    await e.step('7-day history is visible', () async {
      await e.reveal(find.textContaining('E2E video hisobot'));
      await e.shot('w14_history_week_ago');
      expect((await myReports(a)).length, 5);
    });

    await e.step('zone time: exact hours per day and mahalla', () async {
      final server =
          (await apiOk(
                'GET',
                '/daily-reports/my/zone-time?days=8',
                token: a.token,
              ))
              as Map<String, dynamic>;
      final days = (server['days'] as List).cast<Map<String, dynamic>>();
      debugPrint('E2E_INFO zone-time day1=${days.length > 1 ? days[1] : null}');
      expect(days.length, 8);
      await e.tap(find.text('Hududda vaqt'));
      await e.see(find.textContaining('Hududda: '));
      await e.see(find.text("So'nggi 8 kun"));
      await e.wait(1000);
      await e.shot('w15_zone_time_top');
      final stretch =
          (days[1]['stretches'] as List).first as Map<String, dynamic>;
      final from = DateTime.parse(stretch['from'] as String).toLocal();
      final to = DateTime.parse(stretch['to'] as String).toLocal();
      final row = find.textContaining('${clock(from)} – ${clock(to)}');
      await e.reveal(row);
      await e.shot('w16_zone_time_stretches');
      expect(find.textContaining('09:00 – '), findsWidgets);
      expect(find.textContaining('Asaka'), findsWidgets);
      final oldest = DateTime.parse(days.last['date'] as String);
      final months = [
        'yanvar',
        'fevral',
        'mart',
        'aprel',
        'may',
        'iyun',
        'iyul',
        'avgust',
        'sentabr',
        'oktabr',
        'noyabr',
        'dekabr',
      ];
      await e.reveal(
        find.textContaining('${oldest.day}-${months[oldest.month - 1]}'),
      );
      await e.shot('w17_zone_time_oldest');
      await back();
    });

    await e.step('notifications list the territory change', () async {
      final list = await apiOk(
        'GET',
        '/notifications/employee/${a.id}',
        token: a.token,
      );
      debugPrint('E2E_INFO notifications A=$list');
      await openTab('Bosh sahifa');
      await e.reveal(find.byIcon(AppIcons.notification).first);
      await e.tap(find.byIcon(AppIcons.notification).first);
      await e.see(find.textContaining('Hudud'), seconds: 20);
      await e.shot('w18_notifications');
      await back();
    });

    await e.step('unsent draft is saved for A', () async {
      await openReports();
      await compose('A xodimning yuborilmagan qoralamasi');
      await back();
      await e.tap(find.text('Chiqish').last);
      await e.see(find.byKey(const Key('reports_compose_fab')));
      await back();
    });

    await e.step(
      'expired access token is refreshed, user stays signed in',
      () async {
        final prefs = await SharedPreferences.getInstance();
        final before = prefs.getString('auth_refresh_token');
        await prefs.setString('auth_token', 'expired.invalid.token');
        await openReports();
        // The list may come from the offline cache first: wait for the refresh.
        await e.until(
          () => prefs.getString('auth_token') != 'expired.invalid.token',
          seconds: 30,
          what: 'a refreshed access token',
        );
        expect(prefs.getString('auth_token'), isNotNull);
        expect(prefs.getString('auth_refresh_token'), isNot(before));
        expect(find.byKey(const Key('reports_compose_fab')), findsOneWidget);
        await back();
      },
    );

    String? aRefresh;
    Future<void> logout() async {
      await openTab('Profil');
      final exit = button('Chiqish');
      await e.reveal(exit);
      await e.tap(exit);
      await e.see(button('Ha, chiqish'));
      await e.tap(button('Ha, chiqish'));
      await e.see(button('Kirish'), seconds: 30);
    }

    await e.step('logout: cancel keeps the session', () async {
      await openTab('Profil');
      await e.reveal(button('Chiqish'));
      await e.tap(button('Chiqish'));
      await e.tap(button('Bekor qilish'));
      await e.wait(1000);
      expect(button('Chiqish'), findsOneWidget);
    });

    await e.step('logout A', () async {
      final stored = await const FlutterSecureStorage().readAll();
      aRefresh = (await SharedPreferences.getInstance()).getString(
        'auth_refresh_token',
      );
      debugPrint('E2E_INFO secure keys before logout=${stored.keys.toList()}');
      await logout();
      await e.shot('w19_after_logout');
      final left = await const FlutterSecureStorage().readAll();
      final prefs = await SharedPreferences.getInstance();
      debugPrint('E2E_INFO secure keys after logout=${left.keys.toList()}');
      debugPrint('E2E_INFO prefs after logout=${prefs.getKeys()}');
      expect(
        left.keys.where((k) => k.toLowerCase().contains('token')),
        isEmpty,
      );
      expect(prefs.getString('auth_token'), isNull);
      expect(prefs.getString('auth_refresh_token'), isNull);
      expect(prefs.getString('worker_session'), isNull);
      expect(aRefresh, isNotNull, reason: 'refresh token key not found');
      final r = await api(
        'POST',
        '/auth/refresh',
        body: {'refreshToken': aRefresh},
      );
      expect(r.status, 401, reason: 'refresh token still valid after logout');
    });

    await e.step('login B, nothing from A', () async {
      await login(b);
      await e.wait(2500);
      await e.shot('w20_home_b');
      expect(find.textContaining('Alisher'), findsNothing);
      // B has not checked in today, A has.
      expect(button('Keldim — joylashuv bilan'), findsOneWidget);
      await openReports();
      await e.see(find.textContaining(bSecret));
      expect(find.textContaining('E2E '), findsNothing);
      await e.shot('w21_reports_b');
      await e.tap(find.byKey(const Key('reports_compose_fab')));
      await e.see(find.byKey(const Key('report_send_button')));
      expect(find.textContaining('qoralamasi'), findsNothing);
      expect(find.textContaining('Dalolatnoma'), findsNothing);
      await back();
      await e.tap(find.text('Hududda vaqt'));
      await e.see(find.textContaining('Hududda: '));
      expect(find.textContaining('09:00 – '), findsNothing);
      await back();
      await openTab('Bosh sahifa');
      await e.reveal(find.byIcon(AppIcons.notification).first);
      await e.tap(find.byIcon(AppIcons.notification).first);
      await e.wait(2500);
      expect(find.textContaining('Mirzakalon'), findsNothing);
      await back();
      await openTab('Xarita');
      await e.until(
        () => paintedZones().isNotEmpty,
        seconds: 30,
        what: 'B zone',
      );
      expect(paintedZones(), {m4});
    });

    await e.step('logout B, login A again: data and draft come back', () async {
      await logout();
      await login(a);
      await openReports();
      await e.see(find.textContaining('E2E rasmli'));
      expect(find.textContaining(bSecret), findsNothing);
      await e.tap(find.byKey(const Key('reports_compose_fab')));
      await e.see(find.textContaining('A xodimning yuborilmagan qoralamasi'));
      await back();
      await e.tap(find.text('Chiqish').last);
      await e.see(find.byKey(const Key('reports_compose_fab')));
      await back();
    });

    await e.step(
      'face ON with an enrolled face: camera screen has a way back',
      () async {
        // The simulator cannot enroll, so a template is placed for worker A.
        await const FlutterSecureStorage().write(
          key: 'face_template',
          value:
              '{"embedding":[${List.filled(192, 0.07).join(',')}],'
              '"enrolled_at":"${DateTime.now().toIso8601String()}",'
              '"worker_id":"${a.id}"}',
        );
        await logout();
        await apiOk(
          'PATCH',
          '/settings/attendance',
          token: admin,
          body: {'faceRequired': true},
        );
        await login(a);
        // A already checked in today, so the button is "Ishdan chiqish". A's
        // territory is now M2+M3 and the simulator stands in M1: refused first.
        await e.tap(button('Ishdan chiqish'));
        await e.wait(2500);
        debugPrint('E2E_INFO outside the zone: ${e.visibleTexts()}');
        await e.shot('w22_outside_zone_refused');
        expect(find.byKey(const Key('daily_report_card')), findsOneWidget);
        await apiOk(
          'PATCH',
          '/oversight/employee/${a.id}',
          token: admin,
          body: {
            'fullName': a.name,
            'position': 'Mahalla xodimi',
            'assignedMahallaCodes': [m1, m2],
          },
        );
        await e.wait(4000);
        await e.resumeApp();
        await e.tap(button('Ishdan chiqish'));
        await e.gone(
          find.byKey(const Key('daily_report_card')).hitTestable(),
          seconds: 30,
        );
        await e.wait(3000);
        debugPrint('E2E_INFO face check screen: ${e.visibleTexts()}');
        await e.shot('w22_face_on_camera');
        await e.tap(
          find.byWidgetPredicate(
            (w) =>
                w is AppBackButton ||
                (w is Icon &&
                    (w.icon == Icons.close || w.icon == AppIcons.close)),
          ),
        );
        await e.see(find.byKey(const Key('daily_report_card')));
        await apiOk(
          'PATCH',
          '/settings/attendance',
          token: admin,
          body: {'faceRequired': false},
        );
      },
    );

    await e.step('check-out by location', () async {
      await e.resumeApp();
      await openTab('Bosh sahifa');
      await e.tap(button('Ishdan chiqish'));
      await e.gone(button('Ishdan chiqish'), seconds: 40);
      final today =
          (await apiOk('GET', '/attendance/today', token: admin)) as Map;
      final row = (today['roster'] as List)
          .cast<Map<String, dynamic>>()
          .firstWhere((r) => r['employeeId'] == a.id);
      expect(row['checkOut'], isNotNull, reason: 'row=$row');
      await e.shot('w23_checked_out');
    });

    await e.step(
      'revoked session goes cleanly to login from a pushed page',
      () async {
        final prefs = await SharedPreferences.getInstance();
        await openReports();
        final refresh = prefs.getString('auth_refresh_token');
        await apiOk('POST', '/auth/logout', body: {'refreshToken': refresh});
        await prefs.setString('auth_token', 'expired.invalid.token');
        await e.tap(find.byKey(const Key('reports_compose_fab')));
        await e.tap(find.text('Hujjat'));
        await e.see(button('Kirish'), seconds: 30);
        await e.wait(1500);
        await e.shot('w24_session_revoked');
        expect(prefs.getString('auth_refresh_token'), isNull);
        expect(prefs.getString('worker_session'), isNull);
      },
    );

    await e.step(
      'sign in again after a revoked session, then log out',
      () async {
        await login(b);
        await logout();
      },
    );

    await apiOk(
      'PATCH',
      '/settings/attendance',
      token: admin,
      body: {'faceRequired': false},
    );
    e
      ..finish()
      ..restoreFlutterErrors();
    expect(e.failures, isEmpty, reason: e.failures.join('\n'));
    expect(e.uiErrors, isEmpty, reason: e.uiErrors.join('\n'));
  }, timeout: const Timeout(Duration(minutes: 25)));
}
