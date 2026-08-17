import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/news/data/datasources/mock_news_data.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';

/// Yangiliklar (Yangiliklar va e'lonlar) moduli uchun masofaviy ma'lumot
/// manbai.
abstract class NewsRemoteDataSource {
  Future<List<NewsItem>> list();

  Future<NewsItem> getById(String id);
}

/// Mock implementatsiya (backend tayyor bo'lguncha yoki [AppConfig.useMock]
/// `true` bo'lganda) — `mock_news_data.dart`dagi xotiradagi ro'yxat bilan
/// ishlaydi (`MeetingsRemoteDataSourceMockImpl` bilan bir xil naqsh).
class NewsRemoteDataSourceMockImpl implements NewsRemoteDataSource {
  @override
  Future<List<NewsItem>> list() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final published = mockNewsItems
        .where((n) => n.status == NewsStatus.published)
        .toList()
      ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
    return List.unmodifiable(published);
  }

  @override
  Future<NewsItem> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockNewsItems.indexWhere((n) => n.id == id);
    if (index == -1) throw ServerException('Yangilik topilmadi: $id');
    return mockNewsItems[index];
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// `GET /news` YALANG'OCH ro'yxat qaytaradi, har bir element `NewsItem.
/// fromJson` kutgan shaklga (camelCase) bevosita mos — `meetings`
/// modulidan farqli o'laroq maydon moslashtirish (`_adapt*`) shart emas.
///
/// `GET /news/:id` backendda UMUMAN YO'Q (`CatalogController`da faqat
/// `GET/POST /news` va `PATCH`/`DELETE /news/:id` bor) — shuning uchun
/// [getById] to'liq ro'yxatni olib, ID bo'yicha mijoz tomonda qidiradi
/// (`MeetingsRemoteDataSourceApiImpl.getById` bilan bir xil naqsh).
class NewsRemoteDataSourceApiImpl implements NewsRemoteDataSource {
  NewsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<NewsItem>> list() async {
    try {
      final response = await _client.dio.get<List<dynamic>>('/news');
      final rows = response.data ?? const [];
      final items =
          rows
              .map((e) => NewsItem.fromJson(e as Map<String, dynamic>))
              .where((n) => n.status == NewsStatus.published)
              .toList()
            ..sort((a, b) => b.publishedAt.compareTo(a.publishedAt));
      return items;
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<NewsItem> getById(String id) async {
    try {
      // Backendda `GET /news/:id` YO'Q — shuning uchun to'liq ro'yxat
      // olinadi va ID bo'yicha shu yerda (mijoz tomonda) qidiriladi.
      final response = await _client.dio.get<List<dynamic>>('/news');
      final rows = response.data ?? const [];
      final index = rows.indexWhere(
        (e) => (e as Map<String, dynamic>)['id'] == id,
      );
      if (index == -1) {
        throw ServerException('Yangilik topilmadi');
      }
      final rawNews = rows[index] as Map<String, dynamic>;
      return NewsItem.fromJson(rawNews);
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
