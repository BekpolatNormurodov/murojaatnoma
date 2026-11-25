// google_fonts has no public hook for tests.
// ignore_for_file: implementation_imports, depend_on_referenced_packages
import 'dart:convert';
import 'dart:io';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_fonts/src/google_fonts_base.dart' as gf;

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

class _Manifest implements AssetManifest {
  @override
  List<String> listAssets() => [
    for (final w in _weights) 'google_fonts/Inter-$w.ttf',
  ];

  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

/// `AppTheme` (Inter, google_fonts) testda tarmoqsiz ishlashi uchun Flutter
/// SDK'dagi Roboto beriladi — o'lchamlari ham haqiqiyga yaqin (standart test
/// shrifti ancha keng, layout testida yolg'on "overflow" beradi).
void useTestFonts() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final root = Platform.environment['FLUTTER_ROOT']!;
  final roboto = File(
    '$root/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf',
  ).readAsBytesSync();
  gf.assetManifest = _Manifest();
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
        if (key.startsWith('google_fonts/')) {
          return ByteData.sublistView(roboto);
        }
        final file = File('build/unit_test_assets/$key');
        if (!file.existsSync()) return null;
        return ByteData.sublistView(file.readAsBytesSync());
      });
}

/// Fon rejimidagi shrift yuklanishini yakunlaydi — aks holda uning "qayta
/// joylash" callback'i daraxt yo'q qilingach ishlab, testni yiqitadi.
Future<void> drainFonts(WidgetTester tester) async {
  await tester.runAsync(() async {
    await GoogleFonts.pendingFonts();
    await Future<void>.delayed(const Duration(milliseconds: 100));
  });
  await tester.pump();
  await tester.pump();
}

/// [useTestFonts] + barcha ilova uslublarini OLDINDAN yuklash (layout
/// o'rtasida shrift almashib, `TextPainter` assert bermasin).
Future<void> loadTestFonts() async {
  useTestFonts();
  [
    AppTheme.light,
    AppTheme.dark,
    AppTextStyles.h1,
    AppTextStyles.h2,
    AppTextStyles.h3,
    AppTextStyles.body,
    AppTextStyles.bodyStrong,
    AppTextStyles.caption,
    AppTextStyles.label,
    AppTextStyles.button,
  ];
  await GoogleFonts.pendingFonts();
}
