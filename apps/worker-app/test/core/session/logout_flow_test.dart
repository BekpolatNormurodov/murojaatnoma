import 'dart:async';

// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/session/logout_flow.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:worker_app/injection.dart';

class _Repository extends Mock implements AuthRepository {}

void main() {
  testWidgets('a slow sign-out blocks the screen until it finishes', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await getIt.reset();
    addTearDown(getIt.reset);
    final gate = Completer<void>();
    final repository = _Repository();
    when(repository.logout).thenAnswer((_) => gate.future);
    getIt.registerSingleton<AuthRepository>(repository);

    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Column(
              children: [
                TextButton(
                  onPressed: () => unawaited(logoutWithProgress(context)),
                  child: const Text('logout'),
                ),
                TextButton(
                  onPressed: () => taps++,
                  child: const Text('other'),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('logout'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    // The barrier swallows taps and the back button cannot dismiss it.
    await tester.tap(find.text('other'), warnIfMissed: false);
    await tester.binding.handlePopRoute();
    await tester.pump(const Duration(milliseconds: 300));
    expect(taps, 0);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    gate.complete();
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 250));
    }
    expect(find.byType(CircularProgressIndicator), findsNothing);
    verify(repository.logout).called(1);
  });
}
