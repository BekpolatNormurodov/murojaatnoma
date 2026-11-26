import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/tracking/device_status.dart';
import 'package:worker_app/features/tracking/tracking_setup_gate.dart';

import '../../support/fake_http.dart';

DeviceStatus _status({
  bool gps = true,
  String permission = DeviceStatus.always,
  bool exempt = true,
  int? battery,
}) => DeviceStatus(
  gpsEnabled: gps,
  permission: permission,
  batteryExempt: exempt,
  battery: battery,
);

class _Probe extends DeviceProbe {
  DeviceStatus value = _status(battery: 80);

  @override
  Future<DeviceStatus> read() async => value;
}

class _Actions extends TrackingSetupActions {
  _Actions(this.onBattery);

  final VoidCallback onBattery;

  @override
  Future<void> exemptBattery() async => onBattery();
}

void main() {
  test('problem names the first thing that blocks tracking', () {
    expect(_status().problem, isNull);
    expect(_status(gps: false, exempt: false).problem, contains('GPS'));
    expect(
      _status(permission: DeviceStatus.whileInUse).problem,
      contains('Doim'),
    );
    expect(_status(exempt: false).problem, contains('Batareya'));
  });

  test('status is sent when it changes, otherwise once per interval', () async {
    var now = DateTime(2026, 11, 26, 9);
    final http = FakeHttp((_) => json({'ok': true}));
    final probe = _Probe();
    final reporter = DeviceStatusReporter(http.dio(), probe, now: () => now);

    await reporter.report(tracking: true);
    probe.value = _status(battery: 79);
    await reporter.report(tracking: true);
    expect(http.requests, hasLength(1));

    probe.value = _status(gps: false);
    await reporter.report(tracking: false);
    expect(http.requests, hasLength(2));
    expect(
      (http.requests.last.data as Map<String, dynamic>)['gpsEnabled'],
      isFalse,
    );

    now = now.add(const Duration(minutes: 5));
    await reporter.report(tracking: false);
    expect(http.requests, hasLength(3));
  });

  testWidgets('the app stays blocked until every setting is on', (
    tester,
  ) async {
    var status = _status(exempt: false);
    var ready = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: TrackingSetupGate(
          check: () async => status,
          onReady: () => ready++,
          actions: _Actions(() => status = _status()),
          child: const Text('ilova'),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const Key('tracking_setup_gate')), findsOneWidget);
    expect(find.byKey(const Key('setup_gps_done')), findsOneWidget);
    expect(find.byKey(const Key('setup_battery_todo')), findsOneWidget);
    expect(ready, 0);

    await tester.tap(find.byKey(const Key('setup_battery_button')));
    await tester.pump();
    await tester.pump();

    expect(find.byKey(const Key('tracking_setup_gate')), findsNothing);
    expect(find.text('ilova'), findsOneWidget);
    expect(ready, 1);
  });
}
