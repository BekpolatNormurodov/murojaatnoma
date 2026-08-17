import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';

class _MockFlutterSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  group(FaceLocalDataSourceImpl, () {
    late _MockFlutterSecureStorage storage;
    late FaceLocalDataSourceImpl subject;

    setUp(() {
      storage = _MockFlutterSecureStorage();
      subject = FaceLocalDataSourceImpl(storage);
    });

    group('read', () {
      test('returns null when no key is stored', () async {
        when(
          () => storage.read(key: any(named: 'key')),
        ).thenAnswer((_) async => null);

        final result = await subject.read();

        expect(result, isNull);
      });

      test('round-trips a validly-shaped stored template', () async {
        final template = FaceTemplate(
          embedding: const [0.8, 0.6],
          enrolledAt: DateTime(2026),
          workerId: 'W-1042',
        );
        when(
          () => storage.read(key: any(named: 'key')),
        ).thenAnswer((_) async => json.encode(template.toJson()));

        final result = await subject.read();

        expect(result, equals(template));
      });

      test(
        'throws CacheException for non-object JSON (valid JSON, wrong '
        'shape)',
        () async {
          when(
            () => storage.read(key: any(named: 'key')),
          ).thenAnswer((_) async => '"just a string"');

          await expectLater(subject.read(), throwsA(isA<CacheException>()));
        },
      );

      test(
        'throws CacheException for wrong-field-type JSON (the TypeError '
        'path FaceTemplate.fromJson would hit — must not escape uncaught)',
        () async {
          when(() => storage.read(key: any(named: 'key'))).thenAnswer(
            (_) async => '{"embedding":"x","enrolled_at":1,"worker_id":null}',
          );

          await expectLater(subject.read(), throwsA(isA<CacheException>()));
        },
      );
    });
  });
}
