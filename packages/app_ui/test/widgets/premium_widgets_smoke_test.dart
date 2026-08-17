import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('AppSelect builds without throwing and shows hint', (
    tester,
  ) async {
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

    expect(find.text('Viloyat'), findsOneWidget);
    expect(find.text('Tanlang'), findsOneWidget);
    expect(find.byType(AppSelect<String>), findsOneWidget);
  });

  testWidgets('AppSegmented builds without throwing and shows segments', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppSegmented<String>(
            value: 'day',
            segments: const [
              AppSegment(value: 'day', label: 'Kun'),
              AppSegment(value: 'week', label: 'Hafta'),
            ],
            onChanged: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Kun'), findsOneWidget);
    expect(find.text('Hafta'), findsOneWidget);
    expect(find.byType(AppSegmented<String>), findsOneWidget);
  });

  testWidgets(
    'AppSegmented keeps a long label on a single line (no 2-line wrap that '
    'would spill the fixed-height pill)',
    (tester) async {
      const longLabel = 'Коммунальные платежи и обращения граждан';
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 220,
                child: AppSegmented<String>(
                  value: 'a',
                  segments: const [
                    AppSegment(value: 'a', label: longLabel),
                    AppSegment(value: 'b', label: 'Ikkinchi'),
                  ],
                  onChanged: (_) {},
                ),
              ),
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      final label = tester.widget<Text>(find.text(longLabel));
      expect(label.maxLines, 1);
      expect(label.overflow, TextOverflow.ellipsis);
    },
  );

  testWidgets('AppListTile does not overflow when trailing is wide', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 300,
            child: AppListTile(
              title: 'Juda uzun sarlavha matni sinov uchun yozilgan',
              trailing: Text('Juda uzun trailing matni bu yerda ham'),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.textContaining('sarlavha'), findsOneWidget);
  });
}
