import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';

/// "E'lonlar" (yangiliklar) bo'limi uchun masofaviy ma'lumot manbai.
// ignore: one_member_abstracts
abstract class NewsRemoteDataSource {
  /// Barcha yangiliklarni (holatidan qat'i nazar) xom ro'yxat sifatida
  /// oladi — nashr holati bo'yicha filtrlash/tartiblash/cheklash
  /// repository qatlamida (`NewsRepositoryImpl.latest`) bajariladi.
  Future<List<NewsItem>> list();
}

/// `DioException`dan foydalanuvchiga ko'rsatsa bo'ladigan xabarni ajratib
/// oladi — backend (`NestJS`) standart xatolik shakli
/// `{statusCode, message, error}` bo'lib, `message` string YOKI
/// (`class-validator`dan) string ro'yxati bo'lishi mumkin
/// (`CitizenRequestsApiImpl._extractErrorMessage` bilan bir xil naqsh).
String _extractNewsErrorMessage(DioException e) {
  final data = e.response?.data;
  if (data is Map<String, dynamic>) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
    if (message is List && message.isNotEmpty) {
      return message.map((m) => m.toString()).join('\n');
    }
  }
  return e.message ?? 'Server xatosi';
}

/// Real backend implementatsiyasi — `GET https://murojaatnoma.uz/api/news`
/// orqali ishlaydi. Endpoint `@Public` (avtorizatsiya tokeni talab
/// qilinmaydi).
///
/// Javob YALANG'OCH massiv (`List<dynamic>`) YOKI sahifalangan
/// `{data: [...]}` konvert (envelope) shaklida kelishi mumkin — ikkalasi
/// ham qo'llab-quvvatlanadi.
class NewsApiImpl implements NewsRemoteDataSource {
  NewsApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<NewsItem>> list() async {
    try {
      final response = await _client.dio.get<dynamic>('/news');
      final data = response.data;

      final List<dynamic> rawList;
      if (data is List) {
        rawList = data;
      } else if (data is Map<String, dynamic> && data['data'] is List) {
        rawList = data['data'] as List<dynamic>;
      } else {
        rawList = const [];
      }

      return rawList
          .whereType<Map<String, dynamic>>()
          .map(NewsItem.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ServerException(_extractNewsErrorMessage(e));
    }
  }
}
