import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/domain/repositories/meetings_repository.dart';
import 'package:worker_app/features/meetings/domain/usecases/get_meetings.dart';
import 'package:worker_app/features/meetings/presentation/bloc/meetings_cubit.dart';

/// Xotirada ishlaydigan soxta repository — `_FakeApplicationsRepository`
/// (`requests_cubit_test.dart`) uslubiga mos.
class _FakeMeetingsRepository implements MeetingsRepository {
  Either<Failure, List<Meeting>> listResult = const Right([]);

  @override
  Future<Either<Failure, List<Meeting>>> list({MeetingStatus? status}) async {
    return listResult;
  }

  @override
  Future<Either<Failure, Meeting>> getById(String id) {
    throw UnimplementedError('MeetingsCubit does not call getById');
  }

  @override
  Future<Either<Failure, Meeting>> join(String id) {
    throw UnimplementedError('MeetingsCubit does not call join');
  }
}

const _meeting = Meeting(
  id: 'MTG-9001',
  title: 'Sinov majlisi',
  startAt: '2026-07-24T08:00:00',
  durationMin: 30,
  host: 'Sinov Xodim',
  participants: ['Sinov Xodim'],
  status: MeetingStatus.rejalashtirilgan,
);

void main() {
  group(MeetingsCubit, () {
    late _FakeMeetingsRepository repository;

    MeetingsCubit buildCubit() =>
        MeetingsCubit(getMeetings: GetMeetings(repository));

    setUp(() {
      repository = _FakeMeetingsRepository();
    });

    test('initial state is loading (never a blank/white screen)', () {
      expect(buildCubit().state, const MeetingsLoading());
    });

    blocTest<MeetingsCubit, MeetingsState>(
      'load() returns meetings -> emits MeetingsLoaded',
      setUp: () => repository.listResult = const Right([_meeting]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const MeetingsLoading(),
        const MeetingsLoaded([_meeting]),
      ],
    );

    blocTest<MeetingsCubit, MeetingsState>(
      'load() returns an empty list -> emits MeetingsEmpty',
      setUp: () => repository.listResult = const Right([]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [const MeetingsLoading(), const MeetingsEmpty()],
    );

    blocTest<MeetingsCubit, MeetingsState>(
      'load() returns Left(Failure) -> emits MeetingsError with the '
      "failure's message (never uncaught)",
      setUp: () =>
          repository.listResult = const Left(ServerFailure('tarmoq xatosi')),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const MeetingsLoading(),
        const MeetingsError('tarmoq xatosi'),
      ],
    );

    blocTest<MeetingsCubit, MeetingsState>(
      'load(status:) forwards the filter and reload() replays it',
      setUp: () => repository.listResult = const Right([_meeting]),
      build: buildCubit,
      act: (c) async {
        await c.load(status: MeetingStatus.jonli);
        await c.reload();
      },
      expect: () => [
        const MeetingsLoading(),
        const MeetingsLoaded([_meeting]),
        const MeetingsLoading(),
        const MeetingsLoaded([_meeting]),
      ],
      verify: (c) {
        expect(c.statusFilter, MeetingStatus.jonli);
      },
    );
  });
}
