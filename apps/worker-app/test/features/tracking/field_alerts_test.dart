import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/tracking/field_alerts.dart';

import '../../support/fake_http.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  // 2026-11-26 — payshanba.
  var now = DateTime(2026, 11, 26, 10);
  late List<(int, String)> shown;
  late List<Map<String, dynamic>> reports;
  late FakeHttp http;

  FieldAlerts alerts() {
    shown = [];
    reports = [];
    http = FakeHttp((_) => json(reports));
    return FieldAlerts(
      http.dio(),
      (id, title, body) async => shown.add((id, body)),
      now: () => now,
    );
  }

  test(
    'a problem rings once, again after half an hour or when it changes',
    () async {
      now = DateTime(2026, 11, 26, 10);
      final a = alerts();

      await a.check(problem: 'GPS');
      await a.check(problem: 'GPS');
      expect(shown, hasLength(1));

      await a.check(problem: 'Ruxsat');
      now = now.add(const Duration(minutes: 30));
      await a.check(problem: 'Ruxsat');
      expect(shown.map((s) => s.$2), ['GPS', 'Ruxsat', 'Ruxsat']);
    },
  );

  test('nothing rings outside working hours or at the weekend', () async {
    final a = alerts();
    for (final at in [
      DateTime(2026, 11, 26, 8, 59),
      DateTime(2026, 11, 26, 22),
      DateTime(2026, 11, 28, 11),
    ]) {
      now = at;
      await a.check(problem: 'GPS');
    }
    expect(shown, isEmpty);
    expect(http.requests, isEmpty);
  });

  test('a missing report is reminded once a day', () async {
    now = DateTime(2026, 11, 26, 17, 5);
    final a = alerts();
    reports = [
      {'day': '2026-11-25'},
    ];

    await a.check(problem: null);
    now = now.add(const Duration(hours: 1));
    await a.check(problem: null);

    expect(shown.single.$1, FieldAlerts.reportId);
    expect(http.requests, hasLength(1));
  });

  test('no reminder when today\u2019s report is already there', () async {
    now = DateTime(2026, 11, 26, 18);
    final a = alerts();
    reports = [
      {'day': '2026-11-26'},
    ];
    await a.check(problem: null);
    expect(shown, isEmpty);
  });
}
