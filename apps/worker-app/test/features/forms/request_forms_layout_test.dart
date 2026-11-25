import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/leave/presentation/pages/leave_request_page.dart';
import 'package:worker_app/features/premya/presentation/pages/premya_request_page.dart';

/// "Javob so'rash" va "Premya so'rash" formalari: kichik ekran (360×640),
/// 1.3x shrift — overflow yo'q, bo'sh yuborishda validatsiya xabari.
Future<void> _pump(WidgetTester tester, Widget page) async {
  tester.view
    ..physicalSize = const Size(360 * 3, 640 * 3)
    ..devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      locale: const Locale('uz'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: const TextScaler.linear(1.3)),
        child: child!,
      ),
      home: page,
    ),
  );
  await tester.pump(const Duration(seconds: 1));
}

Future<void> _tapSubmit(WidgetTester tester) async {
  final submit = find.text('Yuborish');
  await tester.scrollUntilVisible(
    submit,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.tap(submit);
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  testWidgets('leave request: empty reason shows validation, no overflow', (
    tester,
  ) async {
    await _pump(tester, const LeaveRequestPage());
    expect(tester.takeException(), isNull);
    await _tapSubmit(tester);
    expect(find.text('Sababni kiriting'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('premya request: reason required and amount must be > 0', (
    tester,
  ) async {
    await _pump(tester, const PremyaRequestPage());
    expect(tester.takeException(), isNull);
    await tester.enterText(find.byType(TextField).first, '0');
    await _tapSubmit(tester);
    expect(find.text('Sababni kiritish shart'), findsOneWidget);
    expect(find.textContaining('Summa 1 dan'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
