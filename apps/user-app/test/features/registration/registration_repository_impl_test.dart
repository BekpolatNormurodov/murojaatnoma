import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/registration/data/datasources/registration_local_data_source.dart';
import 'package:user_app/features/registration/data/repositories/registration_repository_impl.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';

/// Xotirada ishlaydigan soxta (fake) lokal manba — haqiqiy
/// `FlutterSecureStorage` platform kanaliga bog'liq emas
/// (`_FakeFaceLocalDataSource` bilan bir xil naqsh).
class _FakeRegistrationLocalDataSource implements RegistrationLocalDataSource {
  CitizenProfile? stored;
  Exception? readError;
  Exception? writeError;

  @override
  Future<CitizenProfile?> read() async {
    final err = readError;
    if (err != null) throw err;
    return stored;
  }

  @override
  Future<void> write(CitizenProfile profile) async {
    final err = writeError;
    if (err != null) throw err;
    stored = profile;
  }
}

void main() {
  group(RegistrationRepositoryImpl, () {
    late _FakeRegistrationLocalDataSource local;
    late RegistrationRepositoryImpl subject;

    const profile = CitizenProfile(
      fullName: 'Aziz Karimov',
      documentType: DocumentType.passport,
      documentNumber: 'AA1234567',
      birthDate: '1990-01-01',
      regionCode: 'samarqand',
      districtCode: 'urgut',
      address: "Urgut tumani, Mustaqillik ko'chasi 5",
    );

    setUp(() {
      local = _FakeRegistrationLocalDataSource();
      subject = RegistrationRepositoryImpl(local: local);
    });

    group('saveProfile', () {
      test(
        'writes the profile to the datasource and returns Right(unit)',
        () async {
          final result = await subject.saveProfile(profile);

          expect(result, equals(const Right<Failure, Unit>(unit)));
          expect(local.stored, equals(profile));
        },
      );

      test(
        'datasource write failure is wrapped into Left(CacheFailure), '
        'never thrown',
        () async {
          local.writeError = CacheException('platform kanali xatosi');

          final result = await subject.saveProfile(profile);

          result.fold(
            (l) => expect(l, isA<CacheFailure>()),
            (r) => fail('expected Left(CacheFailure), got Right: $r'),
          );
        },
      );
    });

    group('getProfile', () {
      test('round-trips a stored profile', () async {
        await subject.saveProfile(profile);

        final result = await subject.getProfile();

        expect(result, equals(const Right<Failure, CitizenProfile?>(profile)));
      });

      test('returns Right(null) when nothing is stored (not registered '
          'yet)', () async {
        final result = await subject.getProfile();

        expect(result, equals(const Right<Failure, CitizenProfile?>(null)));
      });

      test(
        'datasource read failure is wrapped into Left(CacheFailure), '
        'never thrown',
        () async {
          local.readError = CacheException('platform kanali xatosi');

          final result = await subject.getProfile();

          result.fold(
            (l) => expect(l, isA<CacheFailure>()),
            (r) => fail('expected Left(CacheFailure), got Right: $r'),
          );
        },
      );
    });
  });
}
