import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:user_app/features/face/domain/entities/face_template.dart';

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
          ownerId: 'U-2087',
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
            (_) async => '{"embedding":"x","enrolled_at":1,"owner_id":null}',
          );

          await expectLater(subject.read(), throwsA(isA<CacheException>()));
        },
      );
    });

    group('write', () {
      test('writes the JSON-encoded template under the storage key',
          () async {
        final template = FaceTemplate(
          embedding: const [0.1, 0.2],
          enrolledAt: DateTime(2026),
          ownerId: 'U-2087',
        );
        when(
          () => storage.write(
            key: any(named: 'key'),
            value: any(named: 'value'),
          ),
        ).thenAnswer((_) async {});

        await subject.write(template);

        verify(
          () => storage.write(
            key: 'face_template',
            value: json.encode(template.toJson()),
          ),
        ).called(1);
      });
    });
  });
}
