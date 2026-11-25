import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/attendance/data/attendance_history.dart';
import 'package:worker_app/features/attendance/presentation/pages/my_attendance_page.dart';
import 'package:worker_app/injection.dart';

class _History implements AttendanceHistorySource {
  @override
  Future<List<AttendanceHistoryDay>> load({int days = 60}) async {
    final now = DateTime.now();
    DateTime day(int ago) => DateTime(now.year, now.month, now.day - ago);
    DateTime at(DateTime d, int h, int m) =>
        DateTime(d.year, d.month, d.day, h, m);
    return [
      AttendanceHistoryDay(
        date: day(1),
        status: 'present',
        checkIn: at(day(1), 9, 0),
      ),
      AttendanceHistoryDay(
        date: day(2),
        status: 'left',
        checkIn: at(day(2), 8, 55),
        checkOut: at(day(2), 17, 49),
        hours: 8.9,
        checkInFaceChecked: false,
      ),
    ];
  }
}

class _Empty implements AttendanceHistorySource {
  @override
  Future<List<AttendanceHistoryDay>> load({int days = 60}) async => const [];
}

void main() {
  tearDown(() => getIt.reset());

  testWidgets('an empty history says so instead of a bare heading', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    getIt.registerSingleton<AttendanceHistorySource>(_Empty());
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const MyAttendancePage(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.text("Hozircha davomat yozuvlari yo'q"), findsOneWidget);
  });

  testWidgets('past days: missing check-out and durations in hours/minutes', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    getIt.registerSingleton<AttendanceHistorySource>(_History());
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const MyAttendancePage(),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('09:00 → ketish belgilanmagan'), findsOneWidget);
    expect(find.text('08:55 → 17:49 · 8 soat 54 daq'), findsOneWidget);

    await tester.tap(find.text('08:55 → 17:49 · 8 soat 54 daq'));
    await tester.pumpAndSettle();
    expect(find.text('Yuz tekshirilmagan'), findsOneWidget);
    expect(find.text('8 soat 54 daq ishladi'), findsOneWidget);
  });
}
