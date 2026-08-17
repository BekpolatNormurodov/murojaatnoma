import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_requests.dart';
import 'package:user_app/features/requests/presentation/bloc/requests_cubit.dart';

class _MockCitizenRequestsRepository extends Mock
    implements CitizenRequestsRepository {}

void main() {
  group(RequestsCubit, () {
    late CitizenRequestsRepository repository;
    late GetCitizenRequests getCitizenRequests;

    const request = CitizenRequest(
      id: 'CR-1001',
      kind: RequestKind.ariza,
      category: "Ma'lumotnoma",
      title: "Oilaviy holat haqida ma'lumotnoma olish",
      body: "Bank kredit olish uchun ma'lumotnoma kerak.",
      status: RequestStatus.yuborilgan,
      createdAt: '2026-07-22T09:15:00',
    );

    setUp(() {
      repository = _MockCitizenRequestsRepository();
      getCitizenRequests = GetCitizenRequests(repository);
    });

    blocTest<RequestsCubit, RequestsState>(
      'emits [loading, loaded] when requests load successfully',
      setUp: () {
        when(
          () => repository.list(kind: RequestKind.ariza),
        ).thenAnswer((_) async => const Right([request]));
      },
      build: () => RequestsCubit(getCitizenRequests: getCitizenRequests),
      act: (c) => c.load(kind: RequestKind.ariza),
      expect: () => [
        isA<RequestsLoading>(),
        isA<RequestsLoaded>().having((s) => s.items, 'items', const [
          request,
        ]),
      ],
    );

    blocTest<RequestsCubit, RequestsState>(
      'emits [loading, empty] when the repository returns no results',
      setUp: () {
        when(
          () => repository.list(
            kind: RequestKind.shikoyat,
          ),
        ).thenAnswer((_) async => const Right([]));
      },
      build: () => RequestsCubit(getCitizenRequests: getCitizenRequests),
      act: (c) => c.load(kind: RequestKind.shikoyat),
      expect: () => [isA<RequestsLoading>(), isA<RequestsEmpty>()],
    );

    blocTest<RequestsCubit, RequestsState>(
      'emits [loading, error] when the repository fails',
      setUp: () {
        when(
          () => repository.list(
            kind: RequestKind.ariza,
          ),
        ).thenAnswer((_) async => const Left(ServerFailure()));
      },
      build: () => RequestsCubit(getCitizenRequests: getCitizenRequests),
      act: (c) => c.load(kind: RequestKind.ariza),
      expect: () => [
        isA<RequestsLoading>(),
        isA<RequestsError>().having(
          (s) => s.message,
          'message',
          'Server xatosi',
        ),
      ],
    );
  });
}
