import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';
import 'package:user_app/features/news/domain/repositories/news_repository.dart';

/// Bosh sahifadagi "E'lonlar" bo'limi uchun so'nggi yangiliklarni olish.
class GetNews implements UseCase<List<NewsItem>, GetNewsParams> {
  GetNews(this.repository);

  final NewsRepository repository;

  @override
  Future<Either<Failure, List<NewsItem>>> call(GetNewsParams params) {
    return repository.latest(limit: params.limit);
  }
}

/// [GetNews] uchun parametr — nechta so'nggi yangilik olinishi.
class GetNewsParams extends Equatable {
  const GetNewsParams({this.limit = 5});

  final int limit;

  @override
  List<Object?> get props => [limit];
}
