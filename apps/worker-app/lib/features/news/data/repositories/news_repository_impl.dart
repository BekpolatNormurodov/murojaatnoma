// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/news/data/datasources/news_remote_data_source.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';
import 'package:worker_app/features/news/domain/repositories/news_repository.dart';

/// `NewsRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class NewsRepositoryImpl implements NewsRepository {
  NewsRepositoryImpl({required this.remote});

  final NewsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<NewsItem>>> list() async {
    try {
      final result = await remote.list();
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, NewsItem>> getById(String id) async {
    try {
      final result = await remote.getById(id);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
