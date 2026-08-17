import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';
import 'package:worker_app/features/news/domain/repositories/news_repository.dart';

/// Bitta yangilikni ID bo'yicha olish (tafsilotlar sahifasi uchun).
class GetNewsItem implements UseCase<NewsItem, GetNewsItemParams> {
  GetNewsItem(this.repository);

  final NewsRepository repository;

  @override
  Future<Either<Failure, NewsItem>> call(GetNewsItemParams params) {
    return repository.getById(params.id);
  }
}

/// [GetNewsItem] uchun kirish parametri.
class GetNewsItemParams extends Equatable {
  const GetNewsItemParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
