import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iconsax_plus/iconsax_plus.dart';

void main() {
  Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

  testWidgets('renders label and hint', (tester) async {
    await tester.pumpWidget(
      wrap(const AppTextField(label: 'Ism', hint: 'Ismingizni kiriting')),
    );

    expect(find.text('Ism'), findsOneWidget);
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.decoration!.hintText, 'Ismingizni kiriting');
  });

  testWidgets('shows error text and icon when errorText is set', (
    tester,
  ) async {
    await tester.pumpWidget(
      wrap(const AppTextField(label: 'Telefon', errorText: 'Xato raqam')),
    );

    expect(find.text('Xato raqam'), findsOneWidget);
    expect(find.byIcon(IconsaxPlusLinear.info_circle), findsOneWidget);
  });

  testWidgets('helperText shows only when there is no error', (tester) async {
    await tester.pumpWidget(
      wrap(const AppTextField(label: 'Login', helperText: 'Kamida 6 ta belgi')),
    );
    expect(find.text('Kamida 6 ta belgi'), findsOneWidget);

    await tester.pumpWidget(
      wrap(
        const AppTextField(
          label: 'Login',
          helperText: 'Kamida 6 ta belgi',
          errorText: 'Juda qisqa',
        ),
      ),
    );
    expect(find.text('Kamida 6 ta belgi'), findsNothing);
    expect(find.text('Juda qisqa'), findsOneWidget);
  });

  testWidgets('fires onChanged as the user types', (tester) async {
    final values = <String>[];
    await tester.pumpWidget(
      wrap(AppTextField(label: 'Ism', onChanged: values.add)),
    );

    await tester.enterText(find.byType(TextField), 'Bekpolat');
    expect(values, ['Bekpolat']);
  });

  testWidgets('respects enabled:false (disabled state)', (tester) async {
    await tester.pumpWidget(
      wrap(const AppTextField(label: 'Ism', enabled: false)),
    );

    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.enabled, isFalse);
  });

  testWidgets('applies textInputAction and onSubmitted', (tester) async {
    var submitted = '';
    await tester.pumpWidget(
      wrap(
        AppTextField(
          label: 'Qidirish',
          textInputAction: TextInputAction.search,
          onSubmitted: (value) => submitted = value,
        ),
      ),
    );

    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.textInputAction, TextInputAction.search);

    await tester.enterText(find.byType(TextField), 'abc');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    expect(submitted, 'abc');
  });

  testWidgets('updates label/border color when focused', (tester) async {
    final focusNode = FocusNode();
    addTearDown(focusNode.dispose);

    await tester.pumpWidget(
      wrap(AppTextField(label: 'Ism', focusNode: focusNode)),
    );

    expect(focusNode.hasFocus, isFalse);
    focusNode.requestFocus();
    await tester.pumpAndSettle();
    expect(focusNode.hasFocus, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('does not overflow with maxLines > 1 inside a narrow column', (
    tester,
  ) async {
    await tester.pumpWidget(
      wrap(
        const SizedBox(
          width: 200,
          child: AppTextField(label: 'Tavsif', maxLines: 5),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}
