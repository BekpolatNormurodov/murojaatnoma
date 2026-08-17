// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/suggestions/data/datasources/suggestions_remote_data_source.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/domain/repositories/suggestions_repository.dart';

/// `SuggestionsRepository`ning masofaviy-manba (mock/api)
/// implementatsiyasi.
class SuggestionsRepositoryImpl implements SuggestionsRepository {
  SuggestionsRepositoryImpl({required this.remote});

  final SuggestionsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<Suggestion>>> list({
    SuggestionStatus? status,
    String? query,
  }) async {
    try {
      final result = await remote.list(status: status, query: query);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Suggestion>> submit(Suggestion draft) async {
    try {
      final result = await remote.submit(draft);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Suggestion>> vote(String id) async {
    try {
      final result = await remote.vote(id);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
