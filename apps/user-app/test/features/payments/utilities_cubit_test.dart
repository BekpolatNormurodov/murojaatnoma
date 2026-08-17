import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/repositories/payments_repository.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';
import 'package:user_app/features/payments/presentation/bloc/utilities_cubit.dart';

class _MockPaymentsRepository extends Mock implements PaymentsRepository {}

void main() {
  group(UtilitiesCubit, () {
    late PaymentsRepository repository;
    late GetUtilities getUtilities;

    const utility = Utility(
      id: 'UTL-ELEKTR-1',
      type: UtilityType.elektr,
      provider: 'Toshkent Elektr Tarmoqlari',
      accountNumber: '3021 4567 89',
      balanceDue: 145000,
      lastInvoiceAt: '2026-07-01',
    );

    setUp(() {
      repository = _MockPaymentsRepository();
      getUtilities = GetUtilities(repository);
    });

    blocTest<UtilitiesCubit, UtilitiesState>(
      'emits [loading, loaded] when utilities load successfully',
      setUp: () {
        when(
          () => repository.utilities(),
        ).thenAnswer((_) async => const Right([utility]));
      },
      build: () => UtilitiesCubit(getUtilities: getUtilities),
      act: (c) => c.load(),
      expect: () => [
        isA<UtilitiesLoading>(),
        isA<UtilitiesLoaded>().having((s) => s.utilities, 'utilities', const [
          utility,
        ]),
      ],
    );

    blocTest<UtilitiesCubit, UtilitiesState>(
      'emits [loading, error] when the repository fails',
      setUp: () {
        when(
          () => repository.utilities(),
        ).thenAnswer((_) async => const Left(ServerFailure()));
      },
      build: () => UtilitiesCubit(getUtilities: getUtilities),
      act: (c) => c.load(),
      expect: () => [
        isA<UtilitiesLoading>(),
        isA<UtilitiesError>().having(
          (s) => s.message,
          'message',
          'Server xatosi',
        ),
      ],
    );
  });
}
