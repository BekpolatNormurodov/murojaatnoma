import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group(CameraCoverBox, () {
    testWidgets('covers a narrow portrait parent with a wide landscape child '
        'without overflow errors', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 200,
                height: 400,
                child: CameraCoverBox(
                  aspectRatio: 16 / 9,
                  child: ColoredBox(color: AppColors.primary),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.byType(CameraCoverBox), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(CameraCoverBox),
          matching: find.byType(ColoredBox),
        ),
        findsOneWidget,
      );
      expect(find.byType(ClipRect), findsWidgets);
    });

    testWidgets('covers a wide landscape parent with a tall portrait child '
        'without overflow errors', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 400,
                height: 200,
                child: CameraCoverBox(
                  aspectRatio: 9 / 16,
                  child: ColoredBox(color: AppColors.primary),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(
        find.descendant(
          of: find.byType(CameraCoverBox),
          matching: find.byType(ColoredBox),
        ),
        findsOneWidget,
      );
    });

    testWidgets('asserts when aspectRatio is not positive', (tester) async {
      expect(
        () => CameraCoverBox(aspectRatio: 0, child: const SizedBox()),
        throwsAssertionError,
      );
    });
  });
}
