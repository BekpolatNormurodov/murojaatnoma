import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/core/format/phone_format.dart';
import 'package:user_app/core/network/session_auth_interceptor.dart';
import 'package:user_app/features/news/presentation/widgets/news_section.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/features/notifications/presentation/widgets/notification_tile.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/widgets/request_attachment_tile.dart';
import 'package:user_app/injection.dart';

import '../support/app_harness.dart';
import '../support/fonts.dart';
import '../support/small_screen.dart';

Widget _large(Widget child) => localizedApp(
  Builder(
    builder: (context) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: const TextScaler.linear(1.3)),
      child: child,
    ),
  ),
);

void main() {
  setUpAll(loadTestFonts);

  test('phone numbers are grouped; other text is left alone', () {
    expect(formatPhone('+998901234567'), '+998 90 123 45 67');
    expect(formatPhone('+998 901234567'), '+998 90 123 45 67');
    expect(formatPhone('Aliyeva Nodira'), 'Aliyeva Nodira');
    expect(formatPhone('+7900'), '+7900');
  });

  test('old news show a date instead of "53 kun oldin"', () {
    final now = DateTime.now();
    expect(newsDateLabel(now.subtract(const Duration(days: 2))), '2 kun oldin');
    expect(newsDateLabel(DateTime(2026, 1, 5, 12)), '5 Yan 2026');
  });

  test('the app wires the replacement auth interceptor', () async {
    final docs = await Directory.systemTemp.createTemp('di');
    addTearDown(() async {
      await getIt.reset();
      await docs.delete(recursive: true);
    });
    await configureTestApp(docs);
    final dio = getIt<DioClient>().dio;

    expect(dio.interceptors.whereType<SessionAuthInterceptor>(), hasLength(1));
    expect(dio.interceptors.whereType<AuthInterceptor>(), isEmpty);
  });

  testWidgets('audio attachment is labelled as a voice message', (
    tester,
  ) async {
    await tester.pumpWidget(
      localizedApp(
        const Scaffold(
          body: RequestAttachmentTile(
            attachment: RequestAttachment(
              type: RequestAttachmentType.voice,
              path: 'https://x/a',
              name: 'a.m4a',
              sizeBytes: 2048,
            ),
          ),
        ),
      ),
    );
    await drainFonts(tester);

    expect(find.text('Ovozli xabar • 2.0 KB'), findsOneWidget);
  });

  testWidgets('a long notification title keeps the full width', (tester) async {
    useSmallScreen(tester);
    await tester.pumpWidget(
      _large(
        Scaffold(
          body: NotificationTile(
            item: NotificationItem(
              id: 'n',
              type: NotificationType.paymentSuccess,
              title: "To'lov muvaffaqiyatli amalga oshirildi",
              body: 'Matn',
              createdAt: DateTime.now(),
            ),
            onTap: () {},
          ),
        ),
      ),
    );
    await drainFonts(tester);

    final title = tester.getRect(
      find.text("To'lov muvaffaqiyatli amalga oshirildi"),
    );
    expect(title.width, greaterThan(220));
    // Vaqt sarlavha yonida emas, ostida.
    expect(tester.getRect(find.text('Hozir')).top, greaterThan(title.bottom));
  });
}
