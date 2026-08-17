import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/domain/repositories/suggestions_repository.dart';

/// Takliflar ro'yxatini (ixtiyoriy holat filtri/qidiruv bilan) olish.
class GetSuggestions
    implements UseCase<List<Suggestion>, GetSuggestionsParams> {
  GetSuggestions(this.repository);

  final SuggestionsRepository repository;

  @override
  Future<Either<Failure, List<Suggestion>>> call(GetSuggestionsParams params) {
    return repository.list(status: params.status, query: params.query);
  }
}

/// [GetSuggestions] uchun filtr parametrlari.
class GetSuggestionsParams extends Equatable {
  const GetSuggestionsParams({this.status, this.query});

  final SuggestionStatus? status;
  final String? query;

  @override
  List<Object?> get props => [status, query];
}
