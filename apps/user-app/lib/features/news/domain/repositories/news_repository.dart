import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';

/// Fuqarolarga mo'ljallangan yangiliklar/e'lonlar ("E'lonlar" bo'limi)
/// bilan ishlash uchun shartnoma.
// ignore: one_member_abstracts
abstract class NewsRepository {
  /// Nashr etilgan (`published`) so'nggi yangiliklarni, nashr sanasi
  /// bo'yicha kamayish (eng yangisi birinchi) tartibida, [limit]ta
  /// donagacha oladi.
  Future<Either<Failure, List<NewsItem>>> latest({int limit = 5});
}
