import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/core/recording/recording_paths.dart';

void main() {
  group('RecordingPaths.next', () {
    late Directory tempDir;

    setUp(() {
      tempDir = Directory.systemTemp.createTempSync('recording_paths_test');
    });

    tearDown(() {
      if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
    });

    test('builds a stable attachments/<prefix>_<ts>.<ext> path', () async {
      final now = DateTime.fromMillisecondsSinceEpoch(1700000000000);

      final path = await RecordingPaths.next(
        prefix: 'voice',
        extension: 'm4a',
        documentsDirectory: () async => tempDir,
        now: now,
      );

      expect(path, '${tempDir.path}/attachments/voice_1700000000000.m4a');
    });

    test('creates the attachments directory if missing', () async {
      final attachmentsDir = Directory('${tempDir.path}/attachments');
      expect(attachmentsDir.existsSync(), isFalse);

      await RecordingPaths.next(
        prefix: 'video',
        extension: 'mp4',
        documentsDirectory: () async => tempDir,
      );

      expect(attachmentsDir.existsSync(), isTrue);
    });

    test('reuses the attachments directory on repeated calls', () async {
      await RecordingPaths.next(
        prefix: 'voice',
        extension: 'm4a',
        documentsDirectory: () async => tempDir,
      );
      // Ikkinchi chaqiruv `dir.createSync` allaqachon mavjud jild ustida
      // xato tashlamasligini tekshiradi (kod `existsSync()` bilan
      // himoyalangan).
      final path = await RecordingPaths.next(
        prefix: 'video',
        extension: 'mp4',
        documentsDirectory: () async => tempDir,
      );

      expect(path, contains('${tempDir.path}/attachments/'));
    });

    test('two calls with different timestamps produce different paths', () async {
      final first = await RecordingPaths.next(
        prefix: 'voice',
        extension: 'm4a',
        documentsDirectory: () async => tempDir,
        now: DateTime.fromMillisecondsSinceEpoch(1000),
      );
      final second = await RecordingPaths.next(
        prefix: 'voice',
        extension: 'm4a',
        documentsDirectory: () async => tempDir,
        now: DateTime.fromMillisecondsSinceEpoch(2000),
      );

      expect(first, isNot(equals(second)));
    });

    test('dirName constant matches the folder actually used', () async {
      final path = await RecordingPaths.next(
        prefix: 'voice',
        extension: 'm4a',
        documentsDirectory: () async => tempDir,
      );

      expect(path, contains('/${RecordingPaths.dirName}/'));
    });
  });
}
