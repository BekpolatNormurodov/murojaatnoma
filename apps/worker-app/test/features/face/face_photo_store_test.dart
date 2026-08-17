import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';

/// `FacePhotoStoreImpl` — fayl I/O + JPG kodlash `documentsDirectory`
/// inject qilingan vaqtinchalik jild bilan, platforma-kanalisiz to'liq
/// tekshiriladi (real piksel-CAPTURE qurilma-only, bu yerda sinalmaydi).
void main() {
  group(FacePhotoStoreImpl, () {
    late Directory tempDir;
    late FacePhotoStoreImpl subject;

    /// 4x4 RGB (to'q kulrang) — kichik, deterministik test kadri.
    Uint8List sampleRgb(int size) {
      final bytes = Uint8List(size * size * 3);
      for (var i = 0; i < bytes.length; i++) {
        bytes[i] = 120;
      }
      return bytes;
    }

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('face_photo_store_test');
      subject = FacePhotoStoreImpl(documentsDirectory: () async => tempDir);
    });

    tearDown(() async {
      if (tempDir.existsSync()) {
        await tempDir.delete(recursive: true);
      }
    });

    test('currentPath returns null before anything is saved', () async {
      expect(await subject.currentPath(), isNull);
    });

    test('saveRgb writes a JPG and currentPath returns it', () async {
      const size = 8;
      final saved = await subject.saveRgb(sampleRgb(size), size: size);

      expect(saved, isNotNull);
      expect(saved, endsWith('enrolled.jpg'));
      expect(File(saved!).existsSync(), isTrue);
      expect(await subject.currentPath(), saved);

      // JPG (SOI) sarlavha baytlari — haqiqiy rasm yozilganini tasdiqlaydi.
      final written = File(saved).readAsBytesSync();
      expect(written.length, greaterThan(2));
      expect(written[0], 0xFF);
      expect(written[1], 0xD8);
    });

    test('saveRgb returns null for a too-small buffer', () async {
      final saved = await subject.saveRgb(Uint8List(3), size: 8);

      expect(saved, isNull);
      expect(await subject.currentPath(), isNull);
    });

    test('saveRgb returns null for a non-positive size', () async {
      expect(await subject.saveRgb(sampleRgb(4), size: 0), isNull);
    });

    test(
      'a failing documents-directory resolver is swallowed (null, never '
      'throws) so enrollment is never broken',
      () async {
        final failing = FacePhotoStoreImpl(
          documentsDirectory: () async =>
              throw const FileSystemException('no docs'),
        );

        expect(await failing.saveRgb(sampleRgb(8), size: 8), isNull);
        expect(await failing.currentPath(), isNull);
      },
    );
  });
}
