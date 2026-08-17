import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/pin/data/datasources/pin_local_data_source.dart';
import 'package:user_app/features/pin/data/repositories/pin_repository_impl.dart';
import 'package:user_app/features/pin/domain/services/pin_hasher.dart';
import 'package:user_app/features/pin/domain/usecases/set_pin.dart';
import 'package:user_app/features/pin/domain/usecases/verify_pin.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';

class _MockSetPin extends Mock implements SetPin {}

class _MockVerifyPin extends Mock implements VerifyPin {}

class _MockSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  group(PinCubit, () {
    late SetPin setPin;
    late VerifyPin verifyPin;

    PinCubit buildCubit() => PinCubit(setPin: setPin, verifyPin: verifyPin);

    setUpAll(() {
      registerFallbackValue(const SetPinParams('0000'));
      registerFallbackValue(const VerifyPinParams('0000'));
    });

    setUp(() {
      setPin = _MockSetPin();
      verifyPin = _MockVerifyPin();
    });

    test('starts in PinInitial', () {
      expect(buildCubit().state, const PinInitial());
    });

    group('SET flow (submitFirstEntry -> confirmEntry)', () {
      blocTest<PinCubit, PinState>(
        'submitFirstEntry -> PinAwaitingConfirmation (nothing persisted '
        'yet)',
        build: buildCubit,
        act: (cubit) => cubit.submitFirstEntry('1234'),
        expect: () => [const PinAwaitingConfirmation()],
        verify: (_) {
          verifyNever(() => setPin(any()));
        },
      );

      blocTest<PinCubit, PinState>(
        'matching confirmation -> [PinSaving, PinSetSuccess] and persists '
        'the ORIGINAL (first-entry) PIN — not the confirmation string',
        setUp: () {
          when(() => setPin(any())).thenAnswer((_) async => const Right(unit));
        },
        build: buildCubit,
        act: (cubit) async {
          cubit.submitFirstEntry('1234');
          await cubit.confirmEntry('1234');
        },
        skip: 1, // PinAwaitingConfirmation from submitFirstEntry
        expect: () => [const PinSaving(), const PinSetSuccess()],
        verify: (_) {
          verify(() => setPin(const SetPinParams('1234'))).called(1);
        },
      );

      blocTest<PinCubit, PinState>(
        'mismatched confirmation -> PinMismatch, and the PIN is NEVER '
        'persisted',
        build: buildCubit,
        act: (cubit) async {
          cubit.submitFirstEntry('1234');
          await cubit.confirmEntry('9999');
        },
        skip: 1, // PinAwaitingConfirmation from submitFirstEntry
        expect: () => [const PinMismatch()],
        verify: (_) {
          verifyNever(() => setPin(any()));
        },
      );

      blocTest<PinCubit, PinState>(
        'after a mismatch, the next completed entry is treated as a FRESH '
        'first entry (not a second confirmation attempt) — confirmed by '
        'the page re-entering via submitFirstEntry, mirrored here directly',
        build: buildCubit,
        act: (cubit) async {
          cubit.submitFirstEntry('1234');
          await cubit.confirmEntry('0000'); // mismatch
          cubit.submitFirstEntry('5678'); // treated as step 1 again
        },
        skip: 2, // PinAwaitingConfirmation, PinMismatch
        expect: () => [const PinAwaitingConfirmation()],
      );

      blocTest<PinCubit, PinState>(
        'setPin storage failure -> PinStorageError with the failure '
        'message',
        setUp: () {
          when(() => setPin(any())).thenAnswer(
            (_) async => const Left(CacheFailure('disk full')),
          );
        },
        build: buildCubit,
        act: (cubit) async {
          cubit.submitFirstEntry('1234');
          await cubit.confirmEntry('1234');
        },
        skip: 1,
        expect: () => [
          const PinSaving(),
          isA<PinStorageError>().having(
            (s) => s.message,
            'message',
            'disk full',
          ),
        ],
      );
    });

    group('VERIFY flow', () {
      blocTest<PinCubit, PinState>(
        'correct PIN -> [PinVerifying, PinVerifySuccess]',
        setUp: () {
          when(
            () => verifyPin(any()),
          ).thenAnswer((_) async => const Right(true));
        },
        build: buildCubit,
        act: (cubit) => cubit.verifyPin('1234'),
        expect: () => [const PinVerifying(), const PinVerifySuccess()],
        verify: (_) {
          verify(() => verifyPin(const VerifyPinParams('1234'))).called(1);
        },
      );

      blocTest<PinCubit, PinState>(
        'wrong PIN -> [PinVerifying, PinVerifyError] (not an exception)',
        setUp: () {
          when(
            () => verifyPin(any()),
          ).thenAnswer((_) async => const Right(false));
        },
        build: buildCubit,
        act: (cubit) => cubit.verifyPin('0000'),
        expect: () => [const PinVerifying(), const PinVerifyError()],
      );

      blocTest<PinCubit, PinState>(
        'verifyPin storage failure -> PinStorageError, never throws '
        'uncaught',
        setUp: () {
          when(() => verifyPin(any())).thenAnswer(
            (_) async => const Left(CacheFailure('platform kanali xatosi')),
          );
        },
        build: buildCubit,
        act: (cubit) => cubit.verifyPin('1234'),
        expect: () => [
          const PinVerifying(),
          isA<PinStorageError>(),
        ],
      );

      blocTest<PinCubit, PinState>(
        'the Nth (maxAttempts-th) consecutive wrong PIN -> PinLockedOut '
        'instead of PinVerifyError (soft, in-memory lockout)',
        setUp: () {
          when(
            () => verifyPin(any()),
          ).thenAnswer((_) async => const Right(false));
        },
        build: buildCubit,
        act: (cubit) async {
          for (var i = 0; i < PinCubit.maxAttempts; i++) {
            await cubit.verifyPin('0000');
          }
        },
        expect: () => [
          for (var i = 0; i < PinCubit.maxAttempts; i++) ...[
            const PinVerifying(),
            if (i < PinCubit.maxAttempts - 1)
              const PinVerifyError()
            else
              const PinLockedOut(),
          ],
        ],
      );

      blocTest<PinCubit, PinState>(
        'a correct PIN resets the failed-attempts counter back to 0',
        setUp: () {
          when(
            () => verifyPin(any()),
          ).thenAnswer((_) async => const Right(false));
        },
        build: buildCubit,
        act: (cubit) async {
          // maxAttempts-1 wrong attempts (not yet locked out)...
          for (var i = 0; i < PinCubit.maxAttempts - 1; i++) {
            await cubit.verifyPin('0000');
          }
          // ...then a correct one resets the counter...
          when(
            () => verifyPin(any()),
          ).thenAnswer((_) async => const Right(true));
          await cubit.verifyPin('1234');
          // ...so this single wrong attempt is back to PinVerifyError, NOT
          // PinLockedOut (proves the counter actually reset, not just
          // "happened to not reach maxAttempts yet").
          when(
            () => verifyPin(any()),
          ).thenAnswer((_) async => const Right(false));
          await cubit.verifyPin('0000');
        },
        verify: (cubit) {
          expect(cubit.state, const PinVerifyError());
        },
      );
    });
  });

  // Below PinCubit's own tests: exercises the REAL (unmocked)
  // PinRepositoryImpl + PinLocalDataSourceImpl + PinHasher, with only
  // FlutterSecureStorage mocked — this is the layer that actually touches
  // storage, so it's where the SECURITY property ("hashed, never
  // plaintext") can be verified against the genuine hashing code path
  // rather than a mock standing in for it.
  group(
    'PinRepositoryImpl+PinHasher (SECURITY: hashed, never plaintext)',
    () {
      late FlutterSecureStorage storage;
      late PinRepositoryImpl repository;

      const pin = '1234';

      setUp(() {
        storage = _MockSecureStorage();
        repository = PinRepositoryImpl(
          local: PinLocalDataSourceImpl(storage),
        );
      });

      test(
        'setPin persists the SHA-256 hash of the PIN, never the plaintext',
        () async {
          when(
            () => storage.write(
              key: any<String>(named: 'key'),
              value: any<String?>(named: 'value'),
            ),
          ).thenAnswer((_) async {});

          await repository.setPin(pin);

          final captured = verify(
            () => storage.write(
              key: any<String>(named: 'key'),
              value: captureAny<String?>(named: 'value'),
            ),
          ).captured;
          final stored = captured.single as String;

          // SECURITY: never the raw PIN...
          expect(stored, isNot(equals(pin)));
          // ...always its SHA-256 hex digest — matches PinHasher exactly
          // (same production hasher, not a re-implemented formula, so this
          // stays correct even if the salt ever changes).
          expect(stored, const PinHasher().hash(pin));
          expect(stored, hasLength(64)); // sha256 hex digest length
        },
      );

      test(
        'verifyPin compares against the stored HASH, not the plaintext',
        () async {
          when(
            () => storage.read(key: any<String>(named: 'key')),
          ).thenAnswer((_) async => const PinHasher().hash(pin));

          final correct = await repository.verifyPin(pin);
          final wrong = await repository.verifyPin('0000');

          bool? unwrap(Either<Failure, bool> result) =>
              result.fold((_) => null, (matches) => matches);

          expect(unwrap(correct), isTrue);
          expect(unwrap(wrong), isFalse);
        },
      );

      test('hasPin is false until a PIN has been set', () async {
        when(
          () => storage.read(key: any<String>(named: 'key')),
        ).thenAnswer((_) async => null);

        final result = await repository.hasPin();

        expect(
          result.fold((_) => null, (bool hasPin) => hasPin),
          isFalse,
        );
      });
    },
  );
}
