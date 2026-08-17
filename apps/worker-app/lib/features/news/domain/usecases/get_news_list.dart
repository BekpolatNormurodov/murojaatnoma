import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';
import 'package:worker_app/features/news/domain/repositories/news_repository.dart';

/// Yangiliklar ro'yxatini olish. Filtr parametri kerak emas — [NoParams].
class GetNewsList implements UseCase<List<NewsItem>, NoParams> {
  GetNewsList(this.repository);

  final NewsRepository repository;

  @override
  Future<Either<Failure, List<NewsItem>>> call(NoParams params) {
    return repository.list();
  }
}
