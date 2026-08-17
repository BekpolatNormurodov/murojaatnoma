import 'dart:typed_data';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// 1x1, shaffof PNG — `MemoryImage`ga haqiqiy, to'g'ri kodlangan tasvir
/// baytlarini `dart:io` fayl SIZ beradi.
///
/// `Image.file` (haqiqiy disk I/O)dan FARQLI o'laroq — bu fake-async
/// ostida hech qachon tugamaydi va `pumpAndSettle()` osilib qolishiga
/// olib keladi (qarang: `worker_app`/`user_app`dagi `profile_page_test.
/// dart`dagi izoh) — xotiradagi baytlar bilan ishlash haqiqiy diskni
/// kutmaydi. Shunga qaramay, bu test XAVFSIZLIK uchun faqat BITTA
/// `pumpWidget()` chaqiradi (`pumpAndSettle`/qo'shimcha `pump` YO'Q):
/// widget daraxtida `Image` MAVJUDLIGINI tekshiradi (haqiqiy dekodlanib,
/// bo'yalishini emas) — bu aynan `AppAvatar`ning tanlash mantig'i uchun
/// yetarli va hech qachon osilib qolmaydi.
final _transparentPng = Uint8List.fromList(const [
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, //
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, //
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, //
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, //
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, //
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82, //
]);

void main() {
  group(AppAvatar, () {
    testWidgets('with no image/photoUrl renders the name initials', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: AppAvatar(name: 'Sardor Karimov')),
        ),
      );

      expect(find.text('SK'), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('with an image provider renders an Image, not initials', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppAvatar(
              name: 'Sardor Karimov',
              image: MemoryImage(_transparentPng),
            ),
          ),
        ),
      );

      expect(find.byType(Image), findsOneWidget);
      expect(find.text('SK'), findsNothing);
    });

    testWidgets('an empty photoUrl (no image) still falls back to initials', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: AppAvatar(name: 'Bekzod', photoUrl: '')),
        ),
      );

      expect(find.text('B'), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });
  });
}
