import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget harness({
    required FaceScanStatus status,
    required String message,
    double progress = 0,
    IconData? messageIcon,
  }) {
    return MaterialApp(
      home: Scaffold(
        body: SizedBox(
          width: 320,
          height: 520,
          child: FaceScanOverlay(
            status: status,
            message: message,
            progress: progress,
            messageIcon: messageIcon,
          ),
        ),
      ),
    );
  }

  group(FaceScanOverlay, () {
    for (final status in FaceScanStatus.values) {
      testWidgets('builds without throwing for status $status', (tester) async {
        await tester.pumpWidget(
          harness(
            status: status,
            message: 'Yuzingizni ramka ichida ushlab turing',
            progress: 0.5,
            messageIcon: Icons.face_retouching_natural,
          ),
        );
        // Repeating scan/pulse animations never settle — advance by a
        // fixed duration instead of pumpAndSettle().
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));

        expect(tester.takeException(), isNull);
        expect(find.byType(FaceScanOverlay), findsOneWidget);
        expect(find.byType(FaceScanMessage), findsOneWidget);
        expect(
          find.text('Yuzingizni ramka ichida ushlab turing'),
          findsOneWidget,
        );

        // Unmount explicitly so controllers dispose before the test ends.
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }

    testWidgets('swaps the displayed text when message changes', (
      tester,
    ) async {
      await tester.pumpWidget(
        harness(
          status: FaceScanStatus.searching,
          message: 'Yuzingizni qidiryapmiz',
        ),
      );
      await tester.pump();
      expect(find.text('Yuzingizni qidiryapmiz'), findsOneWidget);

      await tester.pumpWidget(
        harness(
          status: FaceScanStatus.aligning,
          message: 'Boshingizni tekis tuting',
          progress: 0.3,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Boshingizni tekis tuting'), findsOneWidget);
      expect(find.text('Yuzingizni qidiryapmiz'), findsNothing);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('renders the one-shot success badge without throwing', (
      tester,
    ) async {
      await tester.pumpWidget(
        harness(status: FaceScanStatus.success, message: 'Tayyor!'),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      expect(tester.takeException(), isNull);
      expect(find.text('Tayyor!'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
    });
  });
}
