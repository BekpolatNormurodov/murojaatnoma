// Dev tool: renders every main user-app (fuqaro) screen at real phone sizes with the
// real Inter font, writes PNGs, and lists every layout error (RenderFlex
// overflow etc.). Run:
//   SHOT_DIR=/tmp/shots INTER_DIR=/path/to/fonts flutter test test/screenshots
// Skipped unless SHOT_DIR is set.
// ignore_for_file: implementation_imports, depend_on_referenced_packages
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/src/google_fonts_base.dart' as gf;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:app_core/app_core.dart' show Failure;
import 'package:dartz/dartz.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';
import 'package:user_app/injection.dart';

/// Real backend is out of reach in tests: a fixed signed-in citizen.
class _FakeAuth implements AuthRepository {
  static const _session = AuthSession(
    token: 't',
    userId: 'u1',
    name: 'Aliyeva Nodira',
    phone: '+998901234567',
    region: 'Toshkent shahri',
  );
  @override
  Future<Either<Failure, Unit>> sendOtp(String phone) async => const Right(unit);
  @override
  Future<Either<Failure, AuthSession>> verifyOtp({required String phone, required String code}) async =>
      const Right(_session);
  @override
  Future<AuthSession?> currentSession() async => _session;
  @override
  Future<void> logout() async {}
}

final _shotDir = Platform.environment['SHOT_DIR'];
final _interDir = Platform.environment['INTER_DIR'];

class _FakeManifest implements AssetManifest {
  _FakeManifest(this._assets);
  final List<String> _assets;
  @override
  List<String> listAssets() => _assets;
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

const _weights = [
  'Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold',
  'ExtraBold', 'Black',
];

/// (route, label) pairs to capture.
const _routes = <(String, String)>[
  ('/home', 'home'),
  ('/kommunalka', 'kommunalka'),
  ('/applications', 'applications'),
  ('/applications/CR-1008', 'application_detail'),
  ('/applications/submit', 'application_submit'),
  ('/profile', 'profile'),
  ('/notifications', 'notifications'),
  ('/payments-history', 'payments_history'),
  ('/reports', 'reports'),
];

/// Device profiles: name, logical size, text scale.
final _devices = Platform.environment['SHOT_TALL'] == '1'
    // Whole scrollable page in one image (long screens like Home).
    ? <(String, Size, double)>[('390_tall', const Size(390, 2600), 1)]
    : <(String, Size, double)>[
        ('360', const Size(360, 780), 1),
        ('390', const Size(390, 844), 1),
        ('360_text130', const Size(360, 780), 1.3),
      ];

void main() {
  if (_shotDir == null || _interDir == null) {
    test('screenshots skipped (set SHOT_DIR and INTER_DIR)', () {});
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
        utf8.decode(message!.buffer.asUint8List(message.offsetInBytes, message.lengthInBytes)),
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
    // Icon fonts (iconsax, MaterialIcons…) from the test asset bundle.
    final manifest = File('build/unit_test_assets/FontManifest.json');
    if (manifest.existsSync()) {
      final families = jsonDecode(manifest.readAsStringSync()) as List<dynamic>;
      for (final f in families.cast<Map<String, dynamic>>()) {
        final loader = FontLoader(f['family'] as String);
        for (final font in (f['fonts'] as List<dynamic>).cast<Map<String, dynamic>>()) {
          final file = File('build/unit_test_assets/${font['asset']}');
          if (file.existsSync()) {
            loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
          }
        }
        await loader.load();
      }
    }
    AppConfig.init(flavor: AppFlavor.dev, useMock: true);
    await configureDependencies();
    // Requests/notifications/auth always talk to the real API — swap in the
    // mock sources before anything resolves them.
    getIt
      ..unregister<AuthRepository>()
      ..registerLazySingleton<AuthRepository>(_FakeAuth.new)
      ..unregister<CitizenRequestsRemoteDataSource>()
      ..registerLazySingleton<CitizenRequestsRemoteDataSource>(CitizenRequestsRemoteDataSourceMockImpl.new)
      ..unregister<NotificationsDataSource>()
      ..registerLazySingleton<NotificationsDataSource>(NotificationsMockDataSource.new);
    final auth = getIt<AuthCubit>();
    await auth.verifyOtp('+998901234567', '000000');
    auth
      ..markRegistered()
      ..markFaceEnrolled()
      ..markPinSet();
  });

  final report = StringBuffer();

  tearDownAll(() {
    File('$_shotDir/REPORT.txt').writeAsStringSync(report.toString());
  });

  for (final (deviceName, size, textScale) in _devices) {
    for (final (route, label) in _routes) {
      testWidgets('$label @ $deviceName', (tester) async {
        tester.view.physicalSize = size * 3;
        tester.view.devicePixelRatio = 3;
        tester.platformDispatcher.textScaleFactorTestValue = textScale;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        debugDisableShadows = false;
        final errors = <String>[];
        final original = FlutterError.onError;
        FlutterError.onError = (details) {
          final msg = details.exceptionAsString();
          // Network images/tiles can't load in tests — not a layout problem.
          if (msg.contains('HTTP request failed') ||
              msg.contains('NetworkImageLoadException') ||
              msg.contains('MissingPluginException') ||
              msg.contains('SocketException')) {
            return;
          }
          final where = details.context?.toString() ?? '';
          final firstLine = msg.split('\n').first;
          // The overflow report names the offending widget's creator line.
          final creator = RegExp(r'file:///[^\s:]+/lib/[^\s]+:\d+:\d+')
                  .firstMatch(details.toString())
                  ?.group(0)
                  ?.replaceAll(RegExp('file:///.*?/lib/'), 'lib/') ??
              '';
          errors.add('$firstLine | $where | $creator');
        };

        final key = GlobalKey();
        await tester.pumpWidget(
          RepaintBoundary(key: key, child: const UserApp()),
        );
        getIt<AppRouter>().config.go(route);
        for (var i = 0; i < 12; i++) {
          await tester.pump(const Duration(milliseconds: 250));
        }
        // Let fonts finish loading, then repaint.
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 200)),
        );
        await tester.pump(const Duration(milliseconds: 300));

        await tester.runAsync(() async {
          final boundary =
              key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
          final image = await boundary.toImage(pixelRatio: 1);
          final png = await image.toByteData(format: ui.ImageByteFormat.png);
          File('$_shotDir/${label}_$deviceName.png')
              .writeAsBytesSync(png!.buffer.asUint8List());
        });

        FlutterError.onError = original;
        debugDisableShadows = true; // the binding asserts this at test end
        // Tear the tree down so pending animation timers are cancelled.
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(seconds: 5));

        report.writeln('== $label @ $deviceName: ${errors.toSet().length} issue(s)');
        for (final e in errors.toSet()) {
          report.writeln('   $e');
        }
      });
    }
  }
}
