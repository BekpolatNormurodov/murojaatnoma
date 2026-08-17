import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<void> pumpOpener(
    WidgetTester tester, {
    required Widget sheetChild,
    bool scrollable = false,
  }) {
    return tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: AppButton(
                label: 'Open',
                onPressed: () => showAppSheet<void>(
                  context: context,
                  title: 'Sheet title',
                  scrollable: scrollable,
                  child: sheetChild,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Finds the [Padding] that carries the keyboard-avoidance bottom inset
  /// (there can be several `Padding`s in the sheet tree — title row, content
  /// area, etc. — so we search by resolved value instead of position).
  bool hasBottomPaddingOf(WidgetTester tester, double value) {
    final paddings = tester.widgetList<Padding>(find.byType(Padding));
    return paddings.any(
      (p) => p.padding.resolve(TextDirection.ltr).bottom == value,
    );
  }

  group('showAppSheet keyboard avoidance', () {
    testWidgets('rises above the keyboard by exactly viewInsets.bottom', (
      tester,
    ) async {
      addTearDown(tester.view.reset);

      late BuildContext sheetContext;
      await pumpOpener(
        tester,
        sheetChild: Builder(
          builder: (context) {
            sheetContext = context;
            return const AppTextField(label: 'Ism', hint: 'Ismingiz');
          },
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('Sheet title'), findsOneWidget);
      expect(find.byType(AppTextField), findsOneWidget);
      // No keyboard yet -> no artificial bottom inset padding.
      expect(hasBottomPaddingOf(tester, 0), isTrue);

      // Simulate the keyboard opening (300 *physical* px — flutter_test's
      // default devicePixelRatio may not be 1.0, so we read back the
      // *logical* inset the sheet actually observed via MediaQuery instead
      // of assuming a fixed logical value).
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      await tester.pump();

      final logicalInset = MediaQuery.viewInsetsOf(sheetContext).bottom;
      expect(logicalInset, greaterThan(0));
      expect(hasBottomPaddingOf(tester, logicalInset), isTrue);
      expect(tester.takeException(), isNull);

      // Focus the field while the keyboard is "up" — must not overflow.
      await tester.tap(find.byType(TextField));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('scrollable:true lets tall content reach the keyboard without '
        'overflowing', (tester) async {
      addTearDown(tester.view.reset);

      await pumpOpener(
        tester,
        scrollable: true,
        sheetChild: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppTextField(label: 'Sarlavha'),
            SizedBox(height: 16),
            AppTextField(label: 'Tavsif', maxLines: 4),
            SizedBox(height: 16),
            AppTextField(label: 'Izoh', maxLines: 4),
          ],
        ),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      // A keyboard tall enough that the static content would no longer
      // fit above it — scrollable:true must absorb this without an
      // overflow error.
      tester.view.viewInsets = const FakeViewPadding(bottom: 400);
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('scrollable:true wraps content in a SingleChildScrollView', (
      tester,
    ) async {
      addTearDown(tester.view.reset);

      await pumpOpener(
        tester,
        scrollable: true,
        sheetChild: const AppTextField(label: 'Ism'),
      );

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.byType(SingleChildScrollView), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('scrollable defaults to false (no extra scroll view)', (
      tester,
    ) async {
      addTearDown(tester.view.reset);

      await pumpOpener(tester, sheetChild: const AppTextField(label: 'Ism'));

      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.byType(SingleChildScrollView), findsNothing);
    });

    testWidgets(
      'existing Flexible/ListView based sheet content (AppSelect) still '
      'opens safely after the keyboard fix',
      (tester) async {
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: AppSelect<String>(
                label: 'Viloyat',
                options: const [
                  AppSelectOption(value: 'a', label: 'Andijon'),
                  AppSelectOption(value: 'b', label: 'Buxoro'),
                ],
                onChanged: (_) {},
              ),
            ),
          ),
        );

        // Tap the hint text painted inside AppSelect's actual tappable box
        // (tapping the widget's bounding-box center can land on the label
        // above the box instead).
        await tester.tap(find.text('Tanlang'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Andijon'), findsOneWidget);
        expect(find.text('Buxoro'), findsOneWidget);
      },
    );
  });
}
