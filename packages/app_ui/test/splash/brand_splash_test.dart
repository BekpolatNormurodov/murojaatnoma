import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('BrandSplash renders appName and tagline, fires onFinished '
      'after the timer elapses', (tester) async {
    var finished = false;

    await tester.pumpWidget(
      MaterialApp(
        home: BrandSplash(
          tagline: 'Raqamli boshqaruv platformasi',
          onFinished: () => finished = true,
        ),
      ),
    );
    await tester.pump();

    // appName defaults to 'Hokimiyat', rendered letter-by-letter for the
    // stagger animation, so collect every Text widget's data instead of
    // looking for one Text('Hokimiyat') widget.
    final rendered = tester
        .widgetList<Text>(find.byType(Text))
        .map((w) => w.data ?? '')
        .join();
    expect(rendered, contains('Hokimiyat'));
    expect(find.text('Raqamli boshqaruv platformasi'), findsOneWidget);
    expect(finished, isFalse);

    await tester.pump(const Duration(seconds: 3));
    expect(finished, isTrue);
  });
}
