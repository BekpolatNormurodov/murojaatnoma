import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/presentation/widgets/zone_day_card.dart';

void main() {
  testWidgets('office time is separate from inside and outside', (
    tester,
  ) async {
    final report = ZoneTimeReport.fromJson({
      'days': [
        {
          'date': '2026-11-25',
          'zoneMinutes': 60,
          'officeMinutes': 30,
          'outsideMinutes': 0,
          'activeMinutes': 90,
          'stretches': [
            {
              'from': '2026-11-25T09:00:00',
              'to': '2026-11-25T09:30:00',
              'minutes': 30,
              'inside': false,
              'office': true,
              'mahallaName': null,
            },
          ],
          'byMahalla': [
            {'name': null, 'minutes': 30, 'inside': false, 'office': true},
          ],
        },
      ],
    });
    final day = report.days.single;
    expect(day.officeMinutes, 30);
    expect(day.stretches.single.office, isTrue);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: ZoneDayCard(day: day)),
      ),
    );
    expect(find.text('Ofisda'), findsOneWidget);
    expect(find.text('Ofis · 30 daq'), findsOneWidget);
    expect(find.textContaining('09:00 – 09:30 · Ofisda'), findsOneWidget);
    expect(find.textContaining('Tuman tashqarisi'), findsNothing);
  });
}
