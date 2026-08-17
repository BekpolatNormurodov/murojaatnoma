import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders children in order inside a scroll view', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AppFormScaffold(
            children: [
              AppTextField(label: 'Sarlavha'),
              SizedBox(height: 16),
              AppTextField(label: 'Tavsif', maxLines: 4),
            ],
          ),
        ),
      ),
    );

    expect(find.byType(SingleChildScrollView), findsOneWidget);
    expect(find.text('Sarlavha'), findsOneWidget);
    expect(find.text('Tavsif'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders a single child when children is omitted', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AppFormScaffold(child: Text('Solo child'))),
      ),
    );

    expect(find.text('Solo child'), findsOneWidget);
  });

  testWidgets('grows scroll padding by the keyboard inset', (tester) async {
    addTearDown(tester.view.reset);

    // resizeToAvoidBottomInset:false is the documented pairing for taking
    // full manual control of the keyboard inset (see AppFormScaffold's
    // dartdoc) — with the Scaffold default (true), Scaffold itself zeroes
    // out `viewInsets` for its body once it has already shrunk it, so
    // there is nothing left for this widget to add (verified against the
    // Flutter SDK's Scaffold._addIfNonNull/removeViewInsets).
    late BuildContext formContext;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          resizeToAvoidBottomInset: false,
          body: AppFormScaffold(
            children: [
              Builder(
                builder: (context) {
                  formContext = context;
                  return const AppTextField(label: 'Ism');
                },
              ),
            ],
          ),
        ),
      ),
    );

    final before = tester.widget<SingleChildScrollView>(
      find.byType(SingleChildScrollView),
    );
    expect(before.padding!.resolve(TextDirection.ltr).bottom, 24);

    // 300 *physical* px — flutter_test's default devicePixelRatio may not
    // be 1.0, so we read back the *logical* inset actually observed via
    // MediaQuery instead of assuming a fixed logical value.
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    await tester.pump();

    final logicalInset = MediaQuery.viewInsetsOf(formContext).bottom;
    expect(logicalInset, greaterThan(0));

    final after = tester.widget<SingleChildScrollView>(
      find.byType(SingleChildScrollView),
    );
    expect(after.padding!.resolve(TextDirection.ltr).bottom, 24 + logicalInset);
    expect(tester.takeException(), isNull);
  });

  testWidgets('keeps actionBar pinned above the keyboard, outside scroll', (
    tester,
  ) async {
    addTearDown(tester.view.reset);

    late BuildContext formContext;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          resizeToAvoidBottomInset: false,
          body: AppFormScaffold(
            actionBar: AppButton(label: 'Yuborish', onPressed: () {}),
            children: [
              Builder(
                builder: (context) {
                  formContext = context;
                  return const AppTextField(label: 'Ism');
                },
              ),
            ],
          ),
        ),
      ),
    );

    expect(find.widgetWithText(AppButton, 'Yuborish'), findsOneWidget);
    expect(find.byType(Expanded), findsOneWidget);

    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    await tester.pump();

    final logicalInset = MediaQuery.viewInsetsOf(formContext).bottom;
    expect(logicalInset, greaterThan(0));

    final paddings = tester.widgetList<Padding>(
      find.ancestor(
        of: find.widgetWithText(AppButton, 'Yuborish'),
        matching: find.byType(Padding),
      ),
    );
    expect(
      paddings.any(
        (p) => p.padding.resolve(TextDirection.ltr).bottom == 12 + logicalInset,
      ),
      isTrue,
    );
    expect(find.widgetWithText(AppButton, 'Yuborish'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('uses onDrag keyboard dismiss behavior by default', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: AppFormScaffold(child: Text('x'))),
      ),
    );

    final scrollView = tester.widget<SingleChildScrollView>(
      find.byType(SingleChildScrollView),
    );
    expect(
      scrollView.keyboardDismissBehavior,
      ScrollViewKeyboardDismissBehavior.onDrag,
    );
  });

  testWidgets('asserts when both child and children are provided', (
    tester,
  ) async {
    expect(
      () => AppFormScaffold(child: const Text('a'), children: const []),
      throwsAssertionError,
    );
  });
}
