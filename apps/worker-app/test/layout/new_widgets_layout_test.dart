import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/widgets/scrollable_empty_state.dart';
import 'package:worker_app/features/attendance/presentation/pages/home_page.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/presentation/widgets/attachment_tile.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';

import '../support/fake_http.dart';

/// 360×640 + 2x shrift.
Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  double keyboard = 0,
}) async {
  tester.view
    ..physicalSize = const Size(360, 640)
    ..devicePixelRatio = 1
    ..viewInsets = FakeViewPadding(bottom: keyboard);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, inner) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: const TextScaler.linear(2)),
        child: inner!,
      ),
      home: Scaffold(body: child),
    ),
  );
  await tester.pump(const Duration(seconds: 2));
}

void main() {
  testWidgets('empty state scrolls instead of overflowing with a keyboard', (
    tester,
  ) async {
    await _pump(
      tester,
      Column(
        children: [
          const SizedBox(height: 150),
          Expanded(
            child: ScrollableEmptyState(
              icon: AppIcons.close,
              title: 'Hech narsa topilmadi',
              message: "Qidiruv so'zini o'zgartirib qayta urinib ko'ring",
              action: AppButton(label: 'Qayta urinish', onPressed: () {}),
            ),
          ),
        ],
      ),
      keyboard: 320,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('tracking warning appears only while tracking is blocked', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final service = LocationTrackingService(
      FakeHttp((_) => json(null)).dio(),
      ensurePermission: () async => false,
    );
    await _pump(
      tester,
      ListView(children: [TrackingWarning(service: service)]),
    );
    expect(find.byKey(const Key('tracking_warning')), findsNothing);
    await service.start();
    await tester.pump();
    expect(find.byKey(const Key('tracking_warning')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await service.stop();
    await tester.pump();
    expect(find.byKey(const Key('tracking_warning')), findsNothing);
  });

  testWidgets('an image attachment opens a full-screen viewer', (tester) async {
    await _pump(
      tester,
      const AttachmentTile(
        attachment: AttachmentRef(
          type: AttachmentType.image,
          path: '/nonexistent/juda_uzun_nomli_rasm_fayli_2026.jpg',
          name: 'juda_uzun_nomli_rasm_fayli_2026.jpg',
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    await tester.tap(find.byType(AppListTile));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(InteractiveViewer), findsOneWidget);
  });
}
