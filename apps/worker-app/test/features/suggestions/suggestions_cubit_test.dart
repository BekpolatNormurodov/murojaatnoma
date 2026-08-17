import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/domain/repositories/suggestions_repository.dart';
import 'package:worker_app/features/suggestions/domain/usecases/get_suggestions.dart';
import 'package:worker_app/features/suggestions/domain/usecases/vote_suggestion.dart';
import 'package:worker_app/features/suggestions/presentation/bloc/suggestions_cubit.dart';

/// Xotirada ishlaydigan soxta repository — `_FakeApplicationsRepository`
/// (`requests_cubit_test.dart`) uslubiga mos.
class _FakeSuggestionsRepository implements SuggestionsRepository {
  Either<Failure, List<Suggestion>> listResult = const Right([]);
  Either<Failure, Suggestion> voteResult = const Left(
    ServerFailure('vote() sozlanmagan'),
  );

  @override
  Future<Either<Failure, List<Suggestion>>> list({
    SuggestionStatus? status,
    String? query,
  }) async => listResult;

  @override
  Future<Either<Failure, Suggestion>> submit(Suggestion draft) {
    throw UnimplementedError('SuggestionsCubit does not call submit');
  }

  @override
  Future<Either<Failure, Suggestion>> vote(String id) async => voteResult;
}

const _suggestion = Suggestion(
  id: 'TKL-9001',
  title: 'Sinov taklifi',
  body: 'Tavsif',
  category: 'Sinov',
  status: SuggestionStatus.yangi,
  createdAt: '2026-07-24T08:00:00',
  votes: 3,
);

void main() {
  group(SuggestionsCubit, () {
    late _FakeSuggestionsRepository repository;

    SuggestionsCubit buildCubit() => SuggestionsCubit(
      getSuggestions: GetSuggestions(repository),
      voteSuggestion: VoteSuggestion(repository),
    );

    setUp(() {
      repository = _FakeSuggestionsRepository();
    });

    test('initial state is loading (never a blank/white screen)', () {
      expect(buildCubit().state, const SuggestionsLoading());
    });

    blocTest<SuggestionsCubit, SuggestionsState>(
      'load() returns suggestions -> emits SuggestionsLoaded',
      setUp: () => repository.listResult = const Right([_suggestion]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const SuggestionsLoading(),
        const SuggestionsLoaded([_suggestion]),
      ],
    );

    blocTest<SuggestionsCubit, SuggestionsState>(
      'load() returns an empty list -> emits SuggestionsEmpty',
      setUp: () => repository.listResult = const Right([]),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [const SuggestionsLoading(), const SuggestionsEmpty()],
    );

    blocTest<SuggestionsCubit, SuggestionsState>(
      'load() returns Left(Failure) -> emits SuggestionsError with the '
      "failure's message (never uncaught)",
      setUp: () => repository.listResult = const Left(
        ServerFailure('tarmoq xatosi'),
      ),
      build: buildCubit,
      act: (c) => c.load(),
      expect: () => [
        const SuggestionsLoading(),
        const SuggestionsError('tarmoq xatosi'),
      ],
    );

    blocTest<SuggestionsCubit, SuggestionsState>(
      'vote() success -> replaces the item in place with the updated one '
      'and clears votingIds (never reloads the whole list)',
      setUp: () {
        repository
          ..listResult = const Right([_suggestion])
          ..voteResult = const Right(
            Suggestion(
              id: 'TKL-9001',
              title: 'Sinov taklifi',
              body: 'Tavsif',
              category: 'Sinov',
              status: SuggestionStatus.yangi,
              createdAt: '2026-07-24T08:00:00',
              votes: 4,
            ),
          );
      },
      build: buildCubit,
      act: (c) async {
        await c.load();
        await c.vote('TKL-9001');
      },
      expect: () => [
        const SuggestionsLoading(),
        const SuggestionsLoaded([_suggestion]),
        const SuggestionsLoaded([_suggestion], votingIds: {'TKL-9001'}),
        isA<SuggestionsLoaded>()
            .having((s) => s.votingIds, 'votingIds', isEmpty)
            .having((s) => s.items.single.votes, 'votes', 4),
      ],
    );

    blocTest<SuggestionsCubit, SuggestionsState>(
      'vote() failure -> reverts to the pre-vote state and returns the '
      "failure's message (never uncaught)",
      setUp: () {
        repository
          ..listResult = const Right([_suggestion])
          ..voteResult = const Left(ServerFailure('ovoz xatosi'));
      },
      build: buildCubit,
      act: (c) async {
        await c.load();
        await c.vote('TKL-9001');
      },
      expect: () => [
        const SuggestionsLoading(),
        const SuggestionsLoaded([_suggestion]),
        const SuggestionsLoaded([_suggestion], votingIds: {'TKL-9001'}),
        const SuggestionsLoaded([_suggestion]),
      ],
    );
  });
}
