import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/tracking/battery_exemption_card.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

import '../../support/fake_http.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  // Only the status matters to the card.
  LocationTrackingService running() =>
      LocationTrackingService(FakeHttp(offline).dio())
        ..status.value = TrackingStatus.running;

  Future<void> pump(WidgetTester tester, Widget card) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
          child: Scaffold(body: ListView(children: [card])),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  const card = Key('battery_exemption_card');

  testWidgets('asks only on tap, survives refusal, hides once exempt', (
    tester,
  ) async {
    var exempt = false;
    var requests = 0;
    final service = running();
    await pump(
      tester,
      BatteryExemptionCard(
        service: service,
        isExempt: () async => exempt,
        request: () async {
          requests++;
          return exempt;
        },
      ),
    );
    expect(find.byKey(card), findsOneWidget);
    expect(requests, 0);

    await tester.tap(find.text('Ruxsat berish'));
    await tester.pumpAndSettle();
    expect(requests, 1);
    expect(find.textContaining('Ruxsat berilmadi'), findsOneWidget);

    // Returning from the system dialog only re-checks, never asks again.
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(requests, 1);

    exempt = true;
    await tester.tap(find.text('Ruxsat berish'));
    await tester.pumpAndSettle();
    expect(find.byKey(card), findsNothing);
  }, variant: TargetPlatformVariant.only(TargetPlatform.android));

  testWidgets('"later" hides the card and is remembered', (tester) async {
    final service = running();
    Widget build() => BatteryExemptionCard(
      key: UniqueKey(),
      service: service,
      isExempt: () async => false,
    );
    await pump(tester, build());
    await tester.tap(find.text('Keyinroq'));
    await tester.pumpAndSettle();
    expect(find.byKey(card), findsNothing);
    await pump(tester, build());
    expect(find.byKey(card), findsNothing);
  }, variant: TargetPlatformVariant.only(TargetPlatform.android));
}
