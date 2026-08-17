import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';

/// Yangiliklar (Yangiliklar va e'lonlar) moduli bilan ishlash uchun
/// shartnoma — ro'yxatni o'qish va bitta yangilikni olish.
abstract class NewsRepository {
  /// Nashr etilgan (`published`) yangiliklar ro'yxatini, nashr sanasi
  /// bo'yicha kamayish (eng yangisi birinchi) tartibida oladi.
  Future<Either<Failure, List<NewsItem>>> list();

  /// Bitta yangilikni ID bo'yicha oladi (tafsilotlar sahifasi uchun).
  Future<Either<Failure, NewsItem>> getById(String id);
}
