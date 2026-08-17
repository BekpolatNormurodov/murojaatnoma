import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';
import 'package:worker_app/features/points/domain/repositories/points_repository.dart';
import 'package:worker_app/features/points/domain/usecases/get_current_points.dart';
import 'package:worker_app/features/points/presentation/bloc/points_cubit.dart';

/// Xotirada ishlaydigan soxta repository — `_FakeApplicationsRepository`
/// (`requests_cubit_test.dart`) uslubiga mos.
class _FakePointsRepository implements PointsRepository {
  Either<Failure, WorkerPoints> currentResult = const Right(
    WorkerPoints(total: 0, history: []),
  );

  @override
  Future<Either<Failure, WorkerPoints>> current() async => currentResult;

  @override
  Future<Either<Failure, List<PointsEntry>>> history() {
    throw UnimplementedError('PointsCubit does not call history() directly');
  }
}

const _entry = PointsEntry(
  id: 'PTS-9001',
  reason: 'Sinov yozuvi',
  delta: 10,
  at: '2026-07-24T08:00:00',
  positive: true,
);

void main() {
  group(PointsCubit, () {
    late _FakePointsRepository repository;

    PointsCubit buildCubit() =>
        PointsCubit(getCurrentPoints: GetCurrentPoints(repository));

    setUp(() {
      repository = _FakePointsRepository();
    });

    test('initial state is loading (never a blank/white screen)', () {
      expect(buildCubit().state, const PointsLoading());
    });

    blocTest<PointsCubit, PointsState>(
      'load() returns points with history -> emits PointsLoaded',
      setUp: () => repository.currentResult = const Right(
        WorkerPoints(total: 10, rank: 3, history: [_entry]),
      ),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const PointsLoading(),
        const PointsLoaded(WorkerPoints(total: 10, rank: 3, history: [_entry])),
      ],
    );

    blocTest<PointsCubit, PointsState>(
      'load() returns points with empty history -> emits PointsEmpty',
      setUp: () => repository.currentResult = const Right(
        WorkerPoints(total: 0, history: []),
      ),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [const PointsLoading(), const PointsEmpty()],
    );

    blocTest<PointsCubit, PointsState>(
      'load() returns Left(Failure) -> emits PointsError with the '
      "failure's message (never uncaught)",
      setUp: () => repository.currentResult = const Left(
        ServerFailure('tarmoq xatosi'),
      ),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const PointsLoading(),
        const PointsError('tarmoq xatosi'),
      ],
    );
  });
}
