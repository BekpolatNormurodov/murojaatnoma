import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
// ignore: implementation_imports
import 'package:google_fonts/src/google_fonts_base.dart' as gf;
// ignore: depend_on_referenced_packages
import 'package:http/testing.dart';
// ignore: depend_on_referenced_packages
import 'package:http/http.dart' as http;
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:worker_app/core/recording/recorded_media.dart';
import 'package:worker_app/core/recording/voice_recorder_sheet.dart';

class _Recorder extends Mock implements AudioRecorder {}

/// A recorded voice file must still exist after "attach": the upload reads it
/// AFTER the sheet is gone.
void main() {
  setUpAll(() => registerFallbackValue(const RecordConfig()));

  testWidgets('attaching keeps the recorded file on disk', (tester) async {
    // `runAsync` below lets real I/O run; keep google_fonts off the network.
    gf.httpClient = MockClient((_) => Completer<http.Response>().future);
    final dir = Directory.systemTemp.createTempSync('voice');
    addTearDown(() => dir.deleteSync(recursive: true));
    final messenger = tester.binding.defaultBinaryMessenger;
    const paths = MethodChannel('plugins.flutter.io/path_provider');
    const permissions = MethodChannel(
      'flutter.baseflow.com/permissions/methods',
    );
    messenger
      ..setMockMethodCallHandler(paths, (_) async => dir.path)
      // microphone (7) -> granted (1)
      ..setMockMethodCallHandler(permissions, (_) async => {7: 1});
    addTearDown(() {
      messenger
        ..setMockMethodCallHandler(paths, null)
        ..setMockMethodCallHandler(permissions, null);
    });

    final recorder = _Recorder();
    final amplitude = StreamController<Amplitude>.broadcast();
    addTearDown(amplitude.close);
    String? path;
    when(
      () => recorder.start(any(), path: any(named: 'path')),
    ).thenAnswer((invocation) async {
      path = invocation.namedArguments[#path] as String;
      File(path!).writeAsBytesSync([1, 2, 3]);
    });
    when(
      () => recorder.onAmplitudeChanged(const Duration(milliseconds: 150)),
    ).thenAnswer((_) => amplitude.stream);
    when(recorder.stop).thenAnswer((_) async => path);
    when(recorder.dispose).thenAnswer((_) async {});

    RecordedMedia? result;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('uz'),
        theme: AppTheme.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              result = await showVoiceRecorderSheet(
                context,
                createRecorder: () => recorder,
              );
            },
            child: const Text('open'),
          ),
        ),
      ),
    );

    Future<void> settle() async {
      for (var i = 0; i < 6; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)),
        );
        await tester.pump(const Duration(milliseconds: 200));
      }
    }

    await tester.tap(find.text('open'));
    await settle();
    await tester.tap(find.byIcon(IconsaxPlusBold.microphone_2).last);
    await settle();
    expect(path, isNotNull);

    // `_stop` discards recordings shorter than 400 ms (real clock).
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 500)),
    );
    amplitude.add(Amplitude(current: -10, max: -5));
    await settle();
    await tester.tap(find.byIcon(IconsaxPlusBold.stop));
    await settle();
    await tester.tap(find.byIcon(AppIcons.send));
    await settle();

    expect(result, isNotNull);
    expect(File(result!.path).existsSync(), isTrue);
  });
}
