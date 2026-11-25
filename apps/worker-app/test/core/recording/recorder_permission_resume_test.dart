import 'dart:async';

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
import 'package:http/http.dart' as http;
// ignore: depend_on_referenced_packages
import 'package:http/testing.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:worker_app/core/recording/voice_recorder_sheet.dart';

class _Recorder extends Mock implements AudioRecorder {}

/// Permission granted in the system settings must be picked up on return,
/// without asking again.
void main() {
  testWidgets('voice sheet leaves "denied" after granting in settings', (
    tester,
  ) async {
    gf.httpClient = MockClient((_) => Completer<http.Response>().future);
    const permissions = MethodChannel(
      'flutter.baseflow.com/permissions/methods',
    );
    var granted = false;
    var requests = 0;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      permissions,
      (call) async {
        if (call.method == 'requestPermissions') {
          requests++;
          // microphone (7) -> permanently denied (4)
          return {7: 4};
        }
        return granted ? 1 : 0;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        permissions,
        null,
      ),
    );
    final recorder = _Recorder();
    when(recorder.dispose).thenAnswer((_) async {});

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('uz'),
        theme: AppTheme.light,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => unawaited(
              showVoiceRecorderSheet(context, createRecorder: () => recorder),
            ),
            child: const Text('open'),
          ),
        ),
      ),
    );

    Future<void> settle() async {
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 150));
      }
    }

    Future<void> resume() async {
      tester.binding
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await settle();
    }

    await tester.tap(find.text('open'));
    await settle();
    final l10n = AppLocalizations.of(tester.element(find.text('open')));
    await tester.tap(find.byIcon(IconsaxPlusBold.microphone_2).last);
    await settle();
    expect(find.text(l10n.recorderOpenSettings), findsOneWidget);

    await resume();
    expect(find.text(l10n.recorderOpenSettings), findsOneWidget);

    granted = true;
    await resume();
    expect(find.text(l10n.recorderOpenSettings), findsNothing);
    expect(requests, 1);
  });
}
