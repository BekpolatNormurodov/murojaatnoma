import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/news/data/datasources/news_remote_data_source.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';
import 'package:user_app/features/news/domain/repositories/news_repository.dart';

/// `NewsRepository`ning masofaviy-manba (API) implementatsiyasi.
class NewsRepositoryImpl implements NewsRepository {
  NewsRepositoryImpl({required this.remote});

  final NewsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<NewsItem>>> latest({int limit = 5}) async {
    try {
      final all = await remote.list();

      // Faqat nashr etilganlar (`published`) fuqarolarga ko'rsatiladi —
      // `draft` holatidagilar hali web-admin orqali tayyorlanmoqda.
      final published = all.where((n) => n.isPublished).toList()
        ..sort((a, b) {
          final aDate = a.publishedAtDate;
          final bDate = b.publishedAtDate;
          if (aDate == null || bDate == null) return 0;
          // Kamayish tartibida — eng yangisi birinchi.
          return bDate.compareTo(aDate);
        });

      final limited = limit > 0 && published.length > limit
          ? published.sublist(0, limit)
          : published;

      return Right(limited);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
