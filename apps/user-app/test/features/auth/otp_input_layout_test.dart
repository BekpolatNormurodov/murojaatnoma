import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/auth/presentation/widgets/otp_input.dart';

import '../../support/fonts.dart';
import '../../support/small_screen.dart';

void main() {
  setUpAll(loadTestFonts);

  testWidgets('six OTP cells fit a 360 dp screen', (tester) async {
    useSmallScreen(tester);
    await tester.pumpWidget(
      localizedApp(
        Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(24),
            // OTP sahifasi kabi `IntrinsicHeight` ichida.
            child: IntrinsicHeight(
              child: Column(children: [OtpInput(onCompleted: (_) {})]),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    final cells = find.descendant(
      of: find.byType(OtpInput),
      matching: find.byType(AnimatedContainer),
    );
    expect(cells, findsNWidgets(6));
    expect(tester.getRect(cells.first).left, greaterThanOrEqualTo(0));
    expect(tester.getRect(cells.last).right, lessThanOrEqualTo(360));
    await drainFonts(tester);
  });
}
