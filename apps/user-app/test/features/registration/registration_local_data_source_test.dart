import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/registration/data/datasources/registration_local_data_source.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';

class _MockFlutterSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  group(RegistrationLocalDataSourceImpl, () {
    late _MockFlutterSecureStorage storage;
    late RegistrationLocalDataSourceImpl subject;

    const profile = CitizenProfile(
      fullName: 'Dilnoza Yusupova',
      documentType: DocumentType.pinfl,
      documentNumber: '12345678901234',
      birthDate: '1995-05-12',
      regionCode: 'toshkent_shahri',
      districtCode: 'chilonzor',
      address: 'Chilonzor tumani, 12-uy',
    );

    setUp(() {
      storage = _MockFlutterSecureStorage();
      subject = RegistrationLocalDataSourceImpl(storage);
    });

    group('read', () {
      test('returns null when no key is stored (not registered yet)', () async {
        when(
          () => storage.read(key: any(named: 'key')),
        ).thenAnswer((_) async => null);

        final result = await subject.read();

        expect(result, isNull);
      });

      test('round-trips a validly-shaped stored profile', () async {
        when(
          () => storage.read(key: any(named: 'key')),
        ).thenAnswer((_) async => json.encode(profile.toJson()));

        final result = await subject.read();

        expect(result, equals(profile));
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
        'throws CacheException when a required field is missing/wrong-typed '
        '(the TypeError path CitizenProfile.fromJson would hit — must not '
        'escape uncaught)',
        () async {
          when(() => storage.read(key: any(named: 'key'))).thenAnswer(
            (_) async => json.encode({
              'full_name': 'Dilnoza Yusupova',
              'document_type': 'pinfl',
              // 'document_number' missing entirely.
              'birth_date': '1995-05-12',
              'region_code': 'toshkent_shahri',
              'district_code': 'chilonzor',
              'address': 'Chilonzor tumani, 12-uy',
            }),
          );

          await expectLater(subject.read(), throwsA(isA<CacheException>()));
        },
      );

      test(
        'throws CacheException for an unrecognized document_type value',
        () async {
          when(() => storage.read(key: any(named: 'key'))).thenAnswer(
            (_) async => json.encode({
              'full_name': 'Dilnoza Yusupova',
              'document_type': 'drivers_license',
              'document_number': '12345678901234',
              'birth_date': '1995-05-12',
              'region_code': 'toshkent_shahri',
              'district_code': 'chilonzor',
              'address': 'Chilonzor tumani, 12-uy',
            }),
          );

          await expectLater(subject.read(), throwsA(isA<CacheException>()));
        },
      );
    });

    group('write', () {
      test('writes the JSON-encoded profile under the storage key', () async {
        when(
          () => storage.write(
            key: any(named: 'key'),
            value: any(named: 'value'),
          ),
        ).thenAnswer((_) async {});

        await subject.write(profile);

        verify(
          () => storage.write(
            key: 'citizen_profile',
            value: json.encode(profile.toJson()),
          ),
        ).called(1);
      });
    });
  });
}
