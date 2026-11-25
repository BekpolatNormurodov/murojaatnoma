// Dev tool: renders every user-app (fuqaro) screen and its loading / empty /
// error / filled states at real phone sizes with real fonts and fake
// repositories. For each scenario one contact sheet is written:
//   360x640 light | 360x640 dark | 360x640 text 1.3 | 412x915 light |
//   412x915 dark
// plus every layout error (RenderFlex overflow etc.) into REPORT.txt. Run:
//   SHOT_DIR=/tmp/shots flutter test test/screenshots
// INTER_DIR=/path/to/fonts uses real Inter (otherwise the SDK's Roboto),
// SHOT_ONLY=home,profile renders only those. Skipped unless SHOT_DIR is set.
// ignore_for_file: implementation_imports, depend_on_referenced_packages
// ignore_for_file: lines_longer_than_80_chars
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:app_ui/app_ui.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/src/google_fonts_base.dart' as gf;
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:user_app/app/app.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:user_app/injection.dart';

import 'scenario_sources.dart';
import '../support/app_harness.dart';

final _shotDir = Platform.environment['SHOT_DIR'];
final _interDir = Platform.environment['INTER_DIR'];
final _only = Platform.environment['SHOT_ONLY']?.split(',').toSet();

class _Manifest implements AssetManifest {
  @override
  List<String> listAssets() => [
    for (final w in _weights.keys) 'google_fonts/Inter-$w.ttf',
  ];
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

/// google_fonts weight name -> nearest Roboto file.
const _weights = {
  'Thin': 'Thin',
  'ExtraLight': 'Light',
  'Light': 'Light',
  'Regular': 'Regular',
  'Medium': 'Medium',
  'SemiBold': 'Medium',
  'Bold': 'Bold',
  'ExtraBold': 'Black',
  'Black': 'Black',
};

class _Face extends MockCubit<FaceState> implements FaceCubit {}

typedef _Act = Future<void> Function(WidgetTester tester);

enum _Auth { out, register, face, pinSet, locked, full }

class _Scenario {
  const _Scenario(
    this.name,
    this.route, {
    this.mode = Mode.filled,
    this.auth = _Auth.full,
    this.extra,
    this.act,
    this.face,
    this.tall = false,
    this.settle = const Duration(seconds: 3),
  });

  final String name;
  final String route;
  final Mode mode;
  final _Auth auth;
  final Object? extra;
  final _Act? act;
  final FaceState? face;

  /// Also render the whole scroll content (360 wide, text 1.3).
  final bool tall;
  final Duration settle;
}

class _Variant {
  const _Variant(this.size, {this.dark = false, this.scale = 1});
  final Size size;
  final bool dark;
  final double scale;
}

const _variants = [
  _Variant(Size(360, 640)),
  _Variant(Size(360, 640), dark: true),
  _Variant(Size(360, 640), scale: 1.3),
  _Variant(Size(412, 915)),
  _Variant(Size(412, 915), dark: true),
];

const _tallVariants = [
  _Variant(Size(360, 1900), scale: 1.3),
  _Variant(Size(412, 1900), dark: true),
];

Future<void> _pumpFor(WidgetTester tester, Duration total) async {
  for (var ms = 0; ms < total.inMilliseconds; ms += 100) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  final shotDir = _shotDir;
  if (shotDir == null) {
    test('screenshots skipped (set SHOT_DIR)', () {});
    return;
  }

  late Directory docs;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    Directory(shotDir).createSync(recursive: true);
    docs = Directory.systemTemp.createTempSync('shots');
    gf.assetManifest = _Manifest();
    final root = Platform.environment['FLUTTER_ROOT']!;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', (message) async {
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
            final name = key.substring('google_fonts/'.length);
            final weight = name.substring('Inter-'.length, name.length - 4);
            file = _interDir != null
                ? File('$_interDir/$name')
                : File(
                    '$root/bin/cache/artifacts/material_fonts/Roboto-${_weights[weight]}.ttf',
                  );
          } else {
            file = File('build/unit_test_assets/$key');
          }
          if (!file.existsSync()) return null;
          return ByteData.sublistView(file.readAsBytesSync());
        });
    // Icon fonts (iconsax, MaterialIcons) from the test asset bundle.
    final families =
        jsonDecode(
              File(
                'build/unit_test_assets/FontManifest.json',
              ).readAsStringSync(),
            )
            as List<dynamic>;
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
    // Text that falls back to the platform default (no style) also gets a
    // real font instead of the test font's boxes.
    for (final family in ['Roboto', '.SF UI Text', '.SF UI Display']) {
      final loader = FontLoader(family)
        ..addFont(
          Future.value(
            ByteData.sublistView(
              File(
                '$root/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf',
              ).readAsBytesSync(),
            ),
          ),
        );
      await loader.load();
    }
  });

  final report = StringBuffer();
  tearDownAll(() {
    File('$shotDir/REPORT.txt').writeAsStringSync(report.toString());
  });

  for (final s in _scenarios) {
    if (_only != null && !_only!.contains(s.name)) continue;
    testWidgets(s.name, (tester) async {
      await _sheet(tester, s, _variants, s.name, docs, report);
      if (s.tall) {
        await _sheet(tester, s, _tallVariants, '${s.name}_tall', docs, report);
      }
    });
  }
}

Future<void> _sheet(
  WidgetTester tester,
  _Scenario s,
  List<_Variant> variants,
  String file,
  Directory docs,
  StringBuffer report,
) async {
  final images = <ui.Image>[];
  for (final v in variants) {
    debugDisableShadows = false;
    tester.view.physicalSize = v.size;
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = v.scale;

    final errors = <String>[];
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
          RegExp(
            r'file:///[^\s]+/(lib/[^\s]+:\d+:\d+)',
          ).firstMatch(details.toString())?.group(1) ??
          '';
      errors.add('${msg.split('\n').first} | $creator');
    };

    await getIt.reset();
    await configureTestApp(docs);
    useScenarioSources(s.mode);
    final face = s.face;
    if (face != null) {
      final cubit = _Face();
      whenListen(cubit, const Stream<FaceState>.empty(), initialState: face);
      stubFaceCubit(cubit);
      await getIt.unregister<FaceCubit>();
      getIt.registerFactoryParam<FaceCubit, String, void>((_, _) => cubit);
    }
    final auth = getIt<AuthCubit>();
    if (s.auth != _Auth.out) {
      await tester.runAsync(() => auth.verifyOtp('+998901234567', '000000'));
      switch (s.auth) {
        case _Auth.register:
        case _Auth.out:
          break;
        case _Auth.face:
          auth.markRegistered(fullName: 'Aliyeva Nodira Baxtiyor qizi');
        case _Auth.pinSet:
          auth
            ..markRegistered(fullName: 'Aliyeva Nodira Baxtiyor qizi')
            ..markFaceEnrolled();
        case _Auth.locked:
          auth
            ..markRegistered(fullName: 'Aliyeva Nodira Baxtiyor qizi')
            ..markFaceEnrolled()
            ..markPinAlreadySet();
        case _Auth.full:
          auth
            ..markRegistered(fullName: 'Aliyeva Nodira Baxtiyor qizi')
            ..markFaceEnrolled()
            ..markPinSet();
      }
    }

    final key = GlobalKey();
    await tester.pumpWidget(RepaintBoundary(key: key, child: const UserApp()));
    if (v.dark) {
      final context = tester.element(find.byType(MaterialApp));
      BlocProvider.of<ThemeCubit>(context).emit(ThemeMode.dark);
    }
    final router = getIt<AppRouter>().config;
    if (s.route != '/splash') router.go(s.route, extra: s.extra);
    await _pumpFor(tester, s.settle);
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 80)),
    );
    await tester.pump(const Duration(milliseconds: 300));
    if (s.act != null) {
      try {
        await s.act!(tester);
        await _pumpFor(tester, const Duration(milliseconds: 1500));
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 80)),
        );
        await tester.pump(const Duration(milliseconds: 300));
      } on Object catch (e) {
        errors.add('action failed: ${'$e'.split('\n').first}');
      }
    }

    await tester.runAsync(() async {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      images.add(await boundary.toImage());
    });

    FlutterError.onError = original;
    debugDisableShadows = true;
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 40));
    if (errors.isNotEmpty) {
      report.writeln(
        '== $file ${v.size.width.toInt()} ${v.dark ? 'dark' : 'light'} x${v.scale}',
      );
      for (final e in errors.toSet()) {
        report.writeln('   $e');
      }
    }
    tester.view.reset();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  }

  const gap = 12.0;
  final width = images.fold<double>(0, (w, i) => w + i.width + gap) - gap;
  final height = images.fold<int>(0, (h, i) => i.height > h ? i.height : h);
  await tester.runAsync(() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder)
      ..drawColor(const Color(0xFFE5007D), BlendMode.src);
    var x = 0.0;
    for (final image in images) {
      canvas.drawImage(image, Offset(x, 0), Paint());
      x += image.width + gap;
    }
    final sheet = await recorder.endRecording().toImage(width.toInt(), height);
    final png = await sheet.toByteData(format: ui.ImageByteFormat.png);
    File('$_shotDir/$file.png').writeAsBytesSync(png!.buffer.asUint8List());
  });
}

Future<void> _tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await tester.ensureVisible(finder.last);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(finder.last);
  await tester.pump(const Duration(milliseconds: 300));
}

final _scenarios = <_Scenario>[
  const _Scenario(
    'splash',
    '/splash',
    auth: _Auth.out,
    settle: Duration(milliseconds: 900),
  ),
  const _Scenario('login', '/login', auth: _Auth.out),
  _Scenario(
    'login_error',
    '/login',
    auth: _Auth.out,
    act: (t) async {
      await t.enterText(find.byType(EditableText).first, '90 12');
      await t.pump(const Duration(milliseconds: 200));
    },
  ),
  const _Scenario('otp', '/otp', auth: _Auth.out, extra: '+998 90 123 45 67'),
  const _Scenario('register', '/register', auth: _Auth.register, tall: true),
  const _Scenario(
    'face_loading',
    '/face/onboarding',
    auth: _Auth.face,
    face: FaceInitializing(),
  ),
  const _Scenario(
    'face_denied',
    '/face/onboarding',
    auth: _Auth.face,
    face: FacePermissionDenied(permanentlyDenied: true),
  ),
  const _Scenario(
    'face_camera_error',
    '/face/onboarding',
    auth: _Auth.face,
    face: FaceCameraError(),
  ),
  const _Scenario(
    'face_searching',
    '/face/onboarding',
    auth: _Auth.face,
    face: FaceSearching(),
  ),
  const _Scenario(
    'face_quality',
    '/face/onboarding',
    auth: _Auth.face,
    face: FacePoorQuality(PoorQualityReason.tooFar),
  ),
  const _Scenario(
    'face_success',
    '/face/onboarding',
    auth: _Auth.face,
    face: FaceSuccess(),
    settle: Duration(milliseconds: 1200),
  ),
  const _Scenario(
    'face_error',
    '/face/onboarding',
    auth: _Auth.face,
    face: FaceError("Yuzni saqlab bo'lmadi. Qayta urinib ko'ring"),
  ),
  const _Scenario('pin_set', '/pin/set', auth: _Auth.pinSet),
  const _Scenario('pin_unlock', '/pin/unlock', auth: _Auth.locked),
  for (final mode in Mode.values) ...[
    _Scenario(
      'home_${mode.name}',
      '/home',
      mode: mode,
      tall: mode != Mode.loading,
    ),
    _Scenario(
      'utilities_${mode.name}',
      '/kommunalka',
      mode: mode,
      tall: mode == Mode.filled,
    ),
    _Scenario(
      'requests_${mode.name}',
      '/applications',
      mode: mode,
      tall: mode == Mode.filled,
    ),
    _Scenario('history_${mode.name}', '/payments-history', mode: mode),
    _Scenario(
      'reports_${mode.name}',
      '/reports',
      mode: mode,
      tall: mode == Mode.filled,
    ),
    _Scenario('notifications_${mode.name}', '/notifications', mode: mode),
  ],
  const _Scenario('detail_loading', '/applications/open', mode: Mode.loading),
  const _Scenario('detail_error', '/applications/open', mode: Mode.error),
  const _Scenario('detail_new', '/applications/new', tall: true),
  const _Scenario('detail_open', '/applications/open', tall: true),
  const _Scenario('detail_resolved', '/applications/resolved', tall: true),
  const _Scenario('detail_rejected', '/applications/rejected', tall: true),
  const _Scenario('submit', '/applications/submit', tall: true),
  _Scenario(
    'submit_invalid',
    '/applications/submit',
    tall: true,
    act: (t) async {
      await t.scrollUntilVisible(
        find.text('Yuborish'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await _tapText(t, 'Yuborish');
    },
  ),
  _Scenario('pay', '/pay', extra: demoUtility, tall: true),
  _Scenario(
    'pay_otp',
    '/pay',
    extra: demoUtility,
    act: (t) async {
      final button = find.byType(AppButton).last;
      await t.ensureVisible(button);
      await t.pump(const Duration(milliseconds: 300));
      await t.tap(button);
      await _pumpFor(t, const Duration(seconds: 2));
    },
  ),
  _Scenario(
    'receipt',
    '/payments-history/receipt',
    extra: demoPayment,
    tall: true,
  ),
  const _Scenario('profile', '/profile', tall: true),
  _Scenario(
    'profile_logout',
    '/profile',
    act: (t) async {
      await t.scrollUntilVisible(
        find.text('Chiqish'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await _tapText(t, 'Chiqish');
    },
  ),
  _Scenario(
    'news_detail',
    '/home',
    act: (t) async {
      final title = find.text(demoNews.first.title);
      await t.scrollUntilVisible(
        title,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await _tapText(t, demoNews.first.title);
    },
  ),
  _Scenario(
    'requests_filter',
    '/applications',
    act: (t) async {
      await t.tap(find.byIcon(IconsaxPlusLinear.filter).first);
    },
  ),
];
