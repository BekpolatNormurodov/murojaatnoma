// Dev tool: renders each worker-app screen in its filled / empty / loading /
// error states at 360x640 and 412x915, light and dark, and at text scale 1.3.
// One sheet PNG per screen+state (variants side by side) plus REPORT.txt with
// layout errors. Run:
//   SHOT_DIR=/tmp/shots INTER_DIR=/path/to/fonts \
//     flutter test test/screenshots/states_test.dart
// Optional: STATES=filled,empty  ONLY=home,map. Skipped unless SHOT_DIR set.
// ignore_for_file: implementation_imports, depend_on_referenced_packages
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/src/google_fonts_base.dart' as gf;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/app/app.dart';
import 'package:worker_app/app/router/app_router.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/attendance/data/datasources/attendance_remote_data_source.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/injection.dart';

import '../support/fake_http.dart';

final _shotDir = Platform.environment['SHOT_DIR'];
final _interDir = Platform.environment['INTER_DIR'];
final _states = (Platform.environment['STATES'] ?? 'filled,empty,loading,error')
    .split(',');
final _only = Platform.environment['ONLY']?.split(',');

class _FakeManifest implements AssetManifest {
  _FakeManifest(this._assets);
  final List<String> _assets;
  @override
  List<String> listAssets() => _assets;
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

const _weights = [
  'Thin',
  'ExtraLight',
  'Light',
  'Regular',
  'Medium',
  'SemiBold',
  'Bold',
  'ExtraBold',
  'Black',
];

const _routes = <(String, String)>[
  ('/home', 'home'),
  ('/requests', 'requests'),
  ('/chat', 'chat'),
  ('/map', 'map'),
  ('/profile', 'profile'),
  ('/notifications', 'notifications'),
  ('/meetings', 'meetings'),
  ('/news', 'news'),
  ('/documents', 'documents'),
  ('/points', 'points'),
  ('/salaries', 'salaries'),
  ('/suggestions', 'suggestions'),
  ('/suggestions/create', 'suggestion_create'),
  ('/schedule', 'schedule'),
  ('/my-attendance', 'my_attendance'),
  ('/reports', 'reports'),
  ('/reports?tab=zone', 'zone_time'),
  ('/reports/new', 'report_new'),
  ('/profile/info', 'personal_info'),
  ('/leave-request', 'leave_request'),
  ('/premya-request', 'premya_request'),
  ('/requests/ARZ-1001', 'request_detail'),
  ('/requests/ARZ-1002/respond', 'request_respond'),
  ('/chat/CHT-1', 'chat_conversation'),
  ('/chat/CHT-3', 'chat_group'),
  ('/meetings/MTG-1', 'meeting_detail'),
  ('/login', 'login'),
  ('/home', 'checkout_tap'),
  ('/my-attendance', 'day_tap'),
];

/// Suratdan oldin bosiladigan matn.
const _taps = {'checkout_tap': 'Ishdan chiqish', 'day_tap': '24'};

/// (name, size, text scale, dark)
const _variants = <(String, Size, double, bool)>[
  ('360', Size(360, 640), 1, false),
  ('360_t130', Size(360, 640), 1.3, false),
  ('412', Size(412, 915), 1, false),
  ('360_dark', Size(360, 640), 1, true),
  ('412_dark_t130', Size(412, 915), 1.3, true),
];

/// Variantlarni yonma-yon bitta rasmga teradi.
Future<void> _sheet(String name, List<ui.Image> images) async {
  const gap = 16.0;
  final width = images.fold<double>(0, (s, i) => s + i.width + gap) - gap;
  final height = images.fold<int>(0, (s, i) => i.height > s ? i.height : s);
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder)
    ..drawRect(
      Rect.fromLTWH(0, 0, width, height.toDouble()),
      Paint()..color = const Color(0xFFFF00FF),
    );
  var x = 0.0;
  for (final image in images) {
    canvas.drawImage(image, Offset(x, 0), Paint());
    x += image.width + gap;
  }
  final out = await recorder.endRecording().toImage(width.round(), height);
  final png = await out.toByteData(format: ui.ImageByteFormat.png);
  File('$_shotDir/$name.png').writeAsBytesSync(png!.buffer.asUint8List());
}

ResponseBody _filledNothing(String path, RequestOptions o) {
  if (path.endsWith('/auth/employee/login')) {
    return json({'accessToken': 'a', 'refreshToken': 'r'});
  }
  if (path.endsWith('/auth/me')) {
    return json({
      'id': 'W-1042',
      'fullName': 'Abdurahmonova Muhayyoxon Sirojiddin qizi',
      'position': 'Mahalla bilan ishlash boshqarmasi bosh mutaxassisi',
      'region': 'Toshkent',
      'hasFace': true,
    });
  }
  if (path.endsWith('/attendance/me')) {
    return json({
      'employeeId': 'W-1042',
      'workStartTime': '09:00',
      'workEndTime': '18:00',
      'faceRequired': false,
      'today': {'date': '2026-11-25', 'status': 'absent'},
      'week': <Object>[],
    });
  }
  if (path.endsWith('/zone-time')) return json({'days': <Object>[]});
  if (path.endsWith('/locations/me')) {
    return json({'assignedMahallas': <Object>[]});
  }
  if (path.endsWith('/zones/geojson')) return json({'features': <Object>[]});
  if (path.endsWith('/settings/attendance')) {
    return json({'faceRequired': false});
  }
  if (path.endsWith('/me/dashboard')) return json(<String, Object>{});
  return json(<Object>[]);
}

Future<void> _boot(String state) async {
  await getIt.reset();
  SharedPreferences.setMockInitialValues({});
  final mock = const {'filled', 'marked', 'checkedin'}.contains(state);
  AppConfig.init(flavor: AppFlavor.dev, useMock: mock);
  await configureDependencies();
  var live = false;
  if (!mock) {
    final never = Completer<ResponseBody>();
    getIt<DioClient>().dio.httpClientAdapter = FakeHttp((o) {
      final path = o.uri.path;
      if (!live || path.contains('/auth/')) return _filledNothing(path, o);
      return switch (state) {
        'loading' => never.future,
        'error' => json({'message': "Server vaqtincha ishlamayapti"}, 500),
        _ => _filledNothing(path, o),
      };
    });
  }
  final auth = getIt<AuthCubit>();
  await auth.login('aziz', 'Xodim2026!');
  auth.markFaceEnrolled();
  if (state == 'marked' || state == 'checkedin') {
    final source =
        getIt<AttendanceRemoteDataSource>()
              as AttendanceRemoteDataSourceMockImpl
          ..faceRequired = false;
    await source.checkIn(latitude: 41.3, longitude: 69.3);
    if (state == 'marked') {
      await source.checkOut(latitude: 41.3, longitude: 69.3);
    }
  }
  live = true;
}

void main() {
  if (_shotDir == null || _interDir == null) {
    test('state screenshots skipped (set SHOT_DIR and INTER_DIR)', () {});
    return;
  }

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // flutter_test draws shadows as hard bands by default (deterministic
    // goldens) — we want what users see.
    debugDisableShadows = false;
    SharedPreferences.setMockInitialValues({});
    // Real Inter via google_fonts' asset path: advertise the files in the
    // manifest, serve their bytes on the assets channel.
    gf.assetManifest = _FakeManifest([
      for (final w in _weights) 'google_fonts/Inter-$w.ttf',
    ]);
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMessageHandler('flutter/assets', (message) async {
      final key = Uri.decodeFull(
        utf8.decode(
          message!.buffer.asUint8List(
            message.offsetInBytes,
            message.lengthInBytes,
          ),
        ),
      );
      final File file;
      if (key.startsWith('google_fonts/')) {
        file = File('$_interDir/${key.substring('google_fonts/'.length)}');
      } else {
        file = File('build/unit_test_assets/$key');
      }
      if (!file.existsSync()) return null;
      final bytes = file.readAsBytesSync();
      return ByteData.sublistView(bytes);
    });
    // In-memory secure storage.
    final secure = <String, String>{};
    messenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        final args = (call.arguments as Map?)?.cast<String, Object?>() ?? {};
        final k = args['key'] as String?;
        switch (call.method) {
          case 'write':
            secure[k!] = args['value']! as String;
            return null;
          case 'read':
            return secure[k];
          case 'delete':
            secure.remove(k);
            return null;
          case 'readAll':
            return secure;
          case 'deleteAll':
            secure.clear();
            return null;
          case 'containsKey':
            return secure.containsKey(k);
        }
        return null;
      },
    );
    // A fixed GPS fix and a scratch directory, so the map and the
    // location-only check-out can be rendered.
    const geo = MethodChannel('flutter.baseflow.com/geolocator');
    messenger.setMockMethodCallHandler(geo, (call) async {
      switch (call.method) {
        case 'isLocationServiceEnabled':
          return true;
        case 'checkPermission' || 'requestPermission':
          return 2; // whileInUse
        case 'getCurrentPosition':
          return <String, Object>{
            'latitude': kWorkplaceLat,
            'longitude': kWorkplaceLng,
            'accuracy': 8.0,
            'timestamp': DateTime.now().millisecondsSinceEpoch,
          };
      }
      return null;
    });
    messenger.setMockMethodCallHandler(
      const MethodChannel('flutter.baseflow.com/geolocator_updates'),
      (call) async => null,
    );
    messenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/path_provider'),
      (call) async => '$_shotDir/app_dir',
    );
    // Icon fonts (iconsax, MaterialIcons…) from the test asset bundle.
    final manifest = File('build/unit_test_assets/FontManifest.json');
    if (manifest.existsSync()) {
      final families = jsonDecode(manifest.readAsStringSync()) as List<dynamic>;
      for (final f in families.cast<Map<String, dynamic>>()) {
        final loader = FontLoader(f['family'] as String);
        for (final font
            in (f['fonts'] as List<dynamic>).cast<Map<String, dynamic>>()) {
          final file = File('build/unit_test_assets/${font['asset']}');
          if (file.existsSync()) {
            loader.addFont(
              Future.value(ByteData.sublistView(file.readAsBytesSync())),
            );
          }
        }
        await loader.load();
      }
    }
  });

  final report = StringBuffer();

  tearDownAll(() {
    File('$_shotDir/REPORT.txt').writeAsStringSync(report.toString());
  });

  for (final state in _states) {
    for (final (route, label) in _routes) {
      if (_only != null && !_only!.contains(label)) continue;
      testWidgets('$label $state', (tester) async {
        final images = <ui.Image>[];
        for (final (name, size, textScale, dark) in _variants) {
          tester.view.physicalSize = size * 3;
          tester.view.devicePixelRatio = 3;
          tester.platformDispatcher.textScaleFactorTestValue = textScale;
          addTearDown(tester.view.reset);
          addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

          debugDisableShadows = false;
          final errors = <String>{};
          final original = FlutterError.onError;
          FlutterError.onError = (details) {
            final msg = details.exceptionAsString();
            if (msg.contains('HTTP request failed') ||
                msg.contains('NetworkImageLoadException') ||
                msg.contains('MissingPluginException') ||
                msg.contains('SocketException')) {
              return;
            }
            final creator =
                RegExp(r'file:///[^\s:]+/lib/[^\s]+:\d+:\d+')
                    .firstMatch(details.toString())
                    ?.group(0)
                    ?.replaceAll(RegExp('file:///.*?/lib/'), 'lib/') ??
                '';
            errors.add('${msg.split('\n').first} | $creator');
          };

          await tester.runAsync(() async {
            await _boot(state).timeout(const Duration(seconds: 8));
            (await SharedPreferences.getInstance()).setString(
              'app-theme',
              dark ? 'dark' : 'light',
            );
          });
          final key = GlobalKey();
          await tester.pumpWidget(
            RepaintBoundary(key: key, child: const WorkerApp()),
          );
          if (label == 'login') getIt<AuthCubit>().reset();
          getIt<AppRouter>().config.go(route);
          // Loading holati qayta urinishlar tugashini kutmaydi.
          final frames = state == 'error' ? 60 : 14;
          for (var i = 0; i < frames; i++) {
            await tester.pump(const Duration(milliseconds: 250));
          }
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 150)),
          );
          // So'rovlar `runAsync`da tugashi mumkin — kirish animatsiyalari
          // ham yakunlansin, shundan keyin suratga olamiz.
          for (var i = 0; i < 4; i++) {
            await tester.pump(const Duration(milliseconds: 300));
          }
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 50)),
          );
          await tester.pump(const Duration(milliseconds: 500));
          if (state != 'loading') {
            // Soxta HTTP javobi bir necha navbatda tugaydi.
            for (var i = 0; i < 20; i++) {
              await tester.runAsync(
                () => Future<void>.delayed(const Duration(milliseconds: 20)),
              );
              await tester.pump(const Duration(milliseconds: 100));
            }
          }
          final tap = _taps[label];
          // Holatda tugma bo'lmasa (masalan check-in qilinmagan) — bosmaymiz.
          if (tap != null && find.text(tap).evaluate().isNotEmpty) {
            await tester.tap(find.text(tap).first);
            for (var i = 0; i < 12; i++) {
              await tester.runAsync(
                () => Future<void>.delayed(const Duration(milliseconds: 120)),
              );
              await tester.pump(const Duration(milliseconds: 300));
            }
          }
          await tester.runAsync(() async {
            final boundary =
                key.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary;
            images.add(await boundary.toImage());
          });
          debugDisableShadows = true;
          await tester.pumpWidget(const SizedBox.shrink());
          await tester.pump(const Duration(minutes: 3));
          // Dio javob zanjiri nol muddatli taymerlar bilan davom etadi.
          for (var i = 0; i < 20; i++) {
            await tester.runAsync(
              () => Future<void>.delayed(const Duration(milliseconds: 10)),
            );
            await tester.pump(const Duration(milliseconds: 1));
          }
          FlutterError.onError = original;
          Object? stray;
          while ((stray = tester.takeException()) != null) {
            errors.add('stray: ${'$stray'.split('\n').first}');
          }
          if (errors.isNotEmpty) {
            report.writeln('== $label $state @ $name');
            for (final e in errors) {
              report.writeln('   $e');
            }
          }
        }
        await tester.runAsync(() => _sheet('${label}_$state', images));
      });
    }
  }
}
