import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/domain/repositories/suggestions_repository.dart';

/// Yangi taklif (ratsionalizatorlik g'oyasi) yuborish.
class SubmitSuggestion implements UseCase<Suggestion, SubmitSuggestionParams> {
  SubmitSuggestion(this.repository);

  final SuggestionsRepository repository;

  @override
  Future<Either<Failure, Suggestion>> call(SubmitSuggestionParams params) {
    return repository.submit(params.draft);
  }
}

/// [SubmitSuggestion] uchun kirish parametri.
class SubmitSuggestionParams extends Equatable {
  const SubmitSuggestionParams(this.draft);

  final Suggestion draft;

  @override
  List<Object?> get props => [draft];
}
