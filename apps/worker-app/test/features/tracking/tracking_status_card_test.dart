import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/features/tracking/tracking_status_card.dart';

import '../../support/fake_http.dart';

void main() {
  Future<LocationTrackingService> pump(
    WidgetTester tester,
    Map<String, Object> prefs,
  ) async {
    SharedPreferences.setMockInitialValues(prefs);
    final service = LocationTrackingService(FakeHttp(offline).dio());
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: TrackingStatusCard(service: service)),
      ),
    );
    return service;
  }

  testWidgets('shown only while tracking runs, with the last send time', (
    tester,
  ) async {
    final service = await pump(tester, {
      LocationTrackingService.lastSentKey:
          DateTime.now().millisecondsSinceEpoch,
    });
    expect(find.byKey(const Key('tracking_status_card')), findsNothing);

    service.status.value = TrackingStatus.running;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Joylashuv yuborilmoqda'), findsOneWidget);
    expect(find.textContaining('hozirgina'), findsOneWidget);
    service.status.value = TrackingStatus.idle;
    await tester.pump();
  });

  testWidgets('queued points are explained while offline', (tester) async {
    final service = await pump(tester, {
      LocationTrackingService.outboxKey: <String>['{}', '{}'],
    });
    service.status.value = TrackingStatus.running;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Aloqa kutilmoqda'), findsOneWidget);
    expect(find.textContaining('2 ta nuqta'), findsOneWidget);
    service.status.value = TrackingStatus.idle;
    await tester.pump();
  });

  testWidgets('a long silence is not called "sending"', (tester) async {
    final service = await pump(tester, {
      LocationTrackingService.lastSentKey: DateTime.now()
          .subtract(const Duration(hours: 20))
          .millisecondsSinceEpoch,
    });
    service.status.value = TrackingStatus.running;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Joylashuv yuborilmayapti'), findsOneWidget);
    service.status.value = TrackingStatus.idle;
    await tester.pump();
  });

  testWidgets('never having sent anything also becomes a warning', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    var now = DateTime(2026, 11, 27, 9);
    final service = LocationTrackingService(FakeHttp(offline).dio());
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrackingStatusCard(service: service, now: () => now),
        ),
      ),
    );
    service.status.value = TrackingStatus.running;
    await tester.pump();
    expect(find.text('Joylashuv aniqlanmoqda'), findsOneWidget);

    now = now.add(const Duration(minutes: 6));
    await tester.pump(const Duration(seconds: 10));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Joylashuv yuborilmayapti'), findsOneWidget);
    service.status.value = TrackingStatus.idle;
    await tester.pump();
  });

  test('another employee\u2019s points and send time are not counted', () async {
    SharedPreferences.setMockInitialValues({
      LocationTrackingService.outboxKey: <String>[
        '{"_owner":"A"}',
        '{"_owner":"B"}',
      ],
      LocationTrackingService.lastSentKey: 1,
      LocationTrackingService.lastSentOwnerKey: 'A',
    });
    final delivery = await LocationTrackingService(
      FakeHttp(offline).dio(),
      ownerId: () => 'B',
    ).delivery();

    expect(delivery.queued, 1);
    expect(delivery.sentAt, isNull);
  });
}
