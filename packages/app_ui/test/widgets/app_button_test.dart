import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('AppButton shows label and fires onPressed', (t) async {
    var tapped = false;
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppButton(label: 'Kirish', onPressed: () => tapped = true),
        ),
      ),
    );
    expect(find.text('Kirish'), findsOneWidget);
    await t.tap(find.byType(AppButton));
    expect(tapped, isTrue);
  });
}
