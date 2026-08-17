import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';
import 'package:worker_app/features/requests/presentation/bloc/requests_cubit.dart';

/// Xotirada ishlaydigan soxta repository — `attendance_cubit_test.dart`
/// dagi `_FakeAttendanceRepository` uslubiga mos.
class _FakeApplicationsRepository implements ApplicationsRepository {
  Either<Failure, List<Application>> listResult = const Right([]);

  @override
  Future<Either<Failure, List<Application>>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  }) async => listResult;

  @override
  Future<Either<Failure, Application>> getById(String id) {
    throw UnimplementedError('RequestsCubit does not call getById');
  }

  @override
  Future<Either<Failure, Application>> respond(
    String id,
    ApplicationResponse response,
  ) {
    throw UnimplementedError('RequestsCubit does not call respond');
  }

  @override
  Future<Either<Failure, Application>> rate(String id, int points) {
    throw UnimplementedError('RequestsCubit does not call rate');
  }
}

const _app = Application(
  id: 'ARZ-3001',
  title: 'Sinov murojaati',
  description: 'Tavsif',
  category: 'Sinov',
  status: ApplicationStatus.yangi,
  priority: ApplicationPriority.orta,
  createdAt: '2026-07-24T08:00:00',
  assignedToMe: true,
  points: 0,
  citizenName: 'Fuqaro',
  citizenPhone: '+998 90 000 00 00',
);

void main() {
  group(RequestsCubit, () {
    late _FakeApplicationsRepository repository;

    RequestsCubit buildCubit() => RequestsCubit(repository: repository);

    setUp(() {
      repository = _FakeApplicationsRepository();
    });

    test('initial state is loading (never a blank/white screen)', () {
      expect(buildCubit().state, const RequestsLoading());
    });

    blocTest<RequestsCubit, RequestsState>(
      'list() returns applications -> emits RequestsLoaded',
      setUp: () => repository.listResult = const Right([_app]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const RequestsLoading(),
        const RequestsLoaded([_app]),
      ],
    );

    blocTest<RequestsCubit, RequestsState>(
      'list() returns an empty list -> emits RequestsEmpty',
      setUp: () => repository.listResult = const Right([]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [const RequestsLoading(), const RequestsEmpty()],
    );

    blocTest<RequestsCubit, RequestsState>(
      'list() returns Left(Failure) -> emits RequestsError with the '
      "failure's message (never uncaught)",
      setUp: () =>
          repository.listResult = const Left(ServerFailure('tarmoq xatosi')),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const RequestsLoading(),
        const RequestsError('tarmoq xatosi'),
      ],
    );

    blocTest<RequestsCubit, RequestsState>(
      'priority filter is applied client-side (repository.list has no '
      'priority parameter) — non-matching items are excluded',
      setUp: () => repository.listResult = const Right([
        _app,
        Application(
          id: 'ARZ-3002',
          title: 'Yuqori muhim',
          description: 'Tavsif',
          category: 'Sinov',
          status: ApplicationStatus.yangi,
          priority: ApplicationPriority.yuqori,
          createdAt: '2026-07-24T08:00:00',
          assignedToMe: true,
          points: 0,
          citizenName: 'Fuqaro',
          citizenPhone: '+998 90 000 00 00',
        ),
      ]),
      build: buildCubit,
      act: (c) => c.load(priority: ApplicationPriority.yuqori),
      expect: () => [
        const RequestsLoading(),
        isA<RequestsLoaded>().having((s) => s.items.map((a) => a.id), 'ids', [
          'ARZ-3002',
        ]),
      ],
    );
  });
}
