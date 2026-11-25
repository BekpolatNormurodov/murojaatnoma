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

  testWidgets('time with no territory is neither inside nor outside', (
    tester,
  ) async {
    final day = ZoneTimeReport.fromJson({
      'days': [
        {
          'date': '2026-11-25',
          'zoneMinutes': 0,
          'officeMinutes': 0,
          'outsideMinutes': 0,
          'unassignedMinutes': 45,
          'activeMinutes': 45,
          'stretches': [
            {
              'from': '2026-11-25T09:00:00',
              'to': '2026-11-25T09:45:00',
              'minutes': 45,
              'inside': false,
              'office': false,
              'assigned': false,
              'mahallaName': 'Olmazor',
            },
          ],
          'byMahalla': [
            {
              'name': 'Olmazor',
              'minutes': 45,
              'inside': false,
              'office': false,
              'assigned': false,
            },
          ],
        },
      ],
    }).days.single;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: SingleChildScrollView(child: ZoneDayCard(day: day)),
        ),
      ),
    );
    expect(find.text('Hudud biriktirilmagan'), findsOneWidget);
    expect(
      find.textContaining('09:00 – 09:45 · Hudud biriktirilmagan'),
      findsOneWidget,
    );
    expect(find.textContaining('Tashqarida'), findsNothing);
    expect(find.text('Hududda'), findsNothing);
  });
}
