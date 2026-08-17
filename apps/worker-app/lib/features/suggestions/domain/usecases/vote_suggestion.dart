import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/domain/repositories/suggestions_repository.dart';

/// Taklifga bitta ovoz qo'shish.
class VoteSuggestion implements UseCase<Suggestion, VoteSuggestionParams> {
  VoteSuggestion(this.repository);

  final SuggestionsRepository repository;

  @override
  Future<Either<Failure, Suggestion>> call(VoteSuggestionParams params) {
    return repository.vote(params.id);
  }
}

/// [VoteSuggestion] uchun kirish parametri.
class VoteSuggestionParams extends Equatable {
  const VoteSuggestionParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
