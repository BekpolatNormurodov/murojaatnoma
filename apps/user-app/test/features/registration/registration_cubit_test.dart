import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/features/registration/domain/usecases/save_citizen_profile.dart';
import 'package:user_app/features/registration/presentation/bloc/registration_cubit.dart';

class _MockRegistrationRepository extends Mock
    implements RegistrationRepository {}

void main() {
  group(RegistrationCubit, () {
    late RegistrationRepository repository;
    late SaveCitizenProfile saveCitizenProfile;

    const profile = CitizenProfile(
      fullName: 'Dilnoza Yusupova',
      documentType: DocumentType.pinfl,
      documentNumber: '12345678901234',
      birthDate: '1995-05-12',
      regionCode: 'toshkent_shahri',
      districtCode: 'chilonzor',
      address: 'Chilonzor tumani, 12-uy',
    );

    setUpAll(() {
      registerFallbackValue(profile);
    });

    setUp(() {
      repository = _MockRegistrationRepository();
      saveCitizenProfile = SaveCitizenProfile(repository);
    });

    RegistrationCubit buildCubit() =>
        RegistrationCubit(saveCitizenProfile: saveCitizenProfile);

    test('starts in RegistrationIdle', () {
      expect(buildCubit().state, const RegistrationIdle());
    });

    blocTest<RegistrationCubit, RegistrationState>(
      'emits [submitting, success] and persists the profile when the '
      'repository saves successfully',
      setUp: () {
        when(
          () => repository.saveProfile(profile),
        ).thenAnswer((_) async => const Right(unit));
      },
      build: buildCubit,
      act: (c) => c.submit(profile),
      expect: () => [
        isA<RegistrationSubmitting>(),
        isA<RegistrationSuccess>().having(
          (s) => s.profile,
          'profile',
          profile,
        ),
      ],
      verify: (_) {
        verify(() => repository.saveProfile(profile)).called(1);
      },
    );

    blocTest<RegistrationCubit, RegistrationState>(
      'emits [submitting, error] (never throws) when the repository fails '
      'to persist the profile — e.g. a secure-storage platform-channel '
      'error',
      setUp: () {
        when(() => repository.saveProfile(profile)).thenAnswer(
          (_) async => const Left(CacheFailure('saqlashda kutilmagan xato')),
        );
      },
      build: buildCubit,
      act: (c) => c.submit(profile),
      expect: () => [
        isA<RegistrationSubmitting>(),
        isA<RegistrationError>().having(
          (s) => s.message,
          'message',
          'saqlashda kutilmagan xato',
        ),
      ],
    );

    blocTest<RegistrationCubit, RegistrationState>(
      'a second submit() after a failure can still succeed (the cubit is '
      'reusable across retries, not left stuck in an error state)',
      setUp: () {
        when(
          () => repository.saveProfile(profile),
        ).thenAnswer((_) async => const Left(CacheFailure('vaqtinchalik')));
      },
      build: buildCubit,
      act: (c) async {
        await c.submit(profile);
        when(
          () => repository.saveProfile(profile),
        ).thenAnswer((_) async => const Right(unit));
        await c.submit(profile);
      },
      expect: () => [
        isA<RegistrationSubmitting>(),
        isA<RegistrationError>(),
        isA<RegistrationSubmitting>(),
        isA<RegistrationSuccess>(),
      ],
    );
  });
}
