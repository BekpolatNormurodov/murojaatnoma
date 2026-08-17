import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/pin/data/datasources/pin_local_data_source.dart';
import 'package:user_app/features/pin/data/repositories/pin_repository_impl.dart';
import 'package:user_app/features/pin/domain/services/pin_hasher.dart';

/// Xotirada ishlaydigan soxta (fake) lokal manba — haqiqiy
/// `FlutterSecureStorage` platform kanaliga bog'liq emas.
class _FakePinLocalDataSource implements PinLocalDataSource {
  String? stored;
  Exception? readError;
  Exception? writeError;

  @override
  Future<String?> readHash() async {
    final err = readError;
    if (err != null) throw err;
    return stored;
  }

  @override
  Future<void> writeHash(String hash) async {
    final err = writeError;
    if (err != null) throw err;
    stored = hash;
  }
}

void main() {
  group(PinRepositoryImpl, () {
    late _FakePinLocalDataSource local;
    late PinRepositoryImpl subject;

    setUp(() {
      local = _FakePinLocalDataSource();
      subject = PinRepositoryImpl(local: local);
    });

    group('setPin', () {
      test('stores the SHA-256 HASH, never the plaintext PIN (security '
          'requirement)', () async {
        final result = await subject.setPin('1234');

        expect(result, equals(const Right<Failure, Unit>(unit)));
        expect(local.stored, isNotNull);
        expect(local.stored, isNot(equals('1234')));
        expect(local.stored, equals(const PinHasher().hash('1234')));
      });

      test('datasource write failure is wrapped into Left(CacheFailure), '
          'never thrown', () async {
        local.writeError = CacheException('platform kanali xatosi');

        final result = await subject.setPin('1234');

        result.fold(
          (l) => expect(l, isA<CacheFailure>()),
          (r) => fail('expected Left(CacheFailure), got Right: $r'),
        );
      });
    });

    group('verifyPin', () {
      test('the exact PIN that was set -> Right(true)', () async {
        await subject.setPin('1234');

        final result = await subject.verifyPin('1234');

        expect(result, equals(const Right<Failure, bool>(true)));
      });

      test('a wrong PIN -> Right(false) (not an error)', () async {
        await subject.setPin('1234');

        final result = await subject.verifyPin('9999');

        expect(result, equals(const Right<Failure, bool>(false)));
      });

      test('no PIN set yet -> Right(false) (not an error)', () async {
        final result = await subject.verifyPin('1234');

        expect(result, equals(const Right<Failure, bool>(false)));
      });

      test('datasource read failure is wrapped into Left(CacheFailure), '
          'never thrown', () async {
        local.readError = CacheException('platform kanali xatosi');

        final result = await subject.verifyPin('1234');

        result.fold(
          (l) => expect(l, isA<CacheFailure>()),
          (r) => fail('expected Left(CacheFailure), got Right: $r'),
        );
      });
    });

    group('hasPin', () {
      test('no PIN set -> Right(false)', () async {
        final result = await subject.hasPin();

        expect(result, equals(const Right<Failure, bool>(false)));
      });

      test('a PIN is set -> Right(true)', () async {
        await subject.setPin('1234');

        final result = await subject.hasPin();

        expect(result, equals(const Right<Failure, bool>(true)));
      });
    });
  });
}
