import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';
import 'package:user_app/features/news/domain/usecases/get_news.dart';
import 'package:user_app/injection.dart';

part 'news_state.dart';

/// Bosh sahifadagi "E'lonlar" bo'limini boshqaruvchi Cubit.
///
/// **Cache-then-network** (`HomeCubit` bilan bir xil naqsh): [load] avval
/// `CacheService`dagi oxirgi ro'yxatni (bo'lsa) DARHOL ko'rsatadi (hech
/// qanday skeleton'siz), so'ng fonda tarmoqdan yangisini so'raydi va
/// kelgach holatni/keshni yangilaydi. Kesh mavjud bo'lib tarmoq
/// muvaffaqiyatsiz bo'lsa — eski (kesh) ma'lumot ekranda QOLDIRILADI (xato
/// faqat log qilinadi), foydalanuvchi keraksiz "xatolik" ko'rinishini
/// ko'rmaydi.
class NewsCubit extends Cubit<NewsState> {
  NewsCubit({required GetNews getNews, CacheService? cache})
    : _getNews = getNews,
      _cache =
          cache ??
          (getIt.isRegistered<CacheService>() ? getIt<CacheService>() : null),
      super(const NewsLoading());

  final GetNews _getNews;
  final CacheService? _cache;
  static const _logger = AppLogger();

  /// `CacheService` kaliti — bosh sahifadagi "E'lonlar" bo'limining oxirgi
  /// muvaffaqiyatli ro'yxati shu kalit ostida saqlanadi.
  static const cacheKey = 'news_latest';

  /// Kesh muddati — qisqa (10 daqiqa): yangiliklar tez-tez o'zgarishi
  /// mumkin, lekin har bosh sahifa ochilishida albatta tarmoqqa
  /// murojaat qilinadi (bu TTL faqat [CacheService.isFresh] uchun,
  /// [load] o'zi har doim fonda tarmoqni ham so'raydi).
  static const _cacheTtl = Duration(minutes: 10);

  /// So'nggi [limit]ta e'lonni yuklaydi (yoki qayta yuklaydi — masalan
  /// "Qayta urinish" tugmasi).
  Future<void> load({int limit = 5}) async {
    final cached = _cache?.getJsonList<NewsItem>(cacheKey, NewsItem.fromJson);
    if (cached != null && cached.isNotEmpty) {
      emit(NewsLoaded(cached));
    } else {
      emit(const NewsLoading());
    }

    final result = await _getNews(GetNewsParams(limit: limit));
    result.fold(
      (failure) {
        if (cached != null && cached.isNotEmpty) {
          // Eski (kesh) ma'lumot allaqachon ekranda — foydalanuvchini
          // keraksiz xato ko'rinishiga tashlamaymiz, faqat diagnostika
          // uchun log qilamiz.
          _logger.logError(failure, null, reason: 'NewsCubit.load');
        } else {
          emit(NewsError(failure.message));
        }
      },
      (items) {
        unawaited(
          _cache?.setJson(
            cacheKey,
            items.map((n) => n.toJson()).toList(),
            ttl: _cacheTtl,
          ),
        );
        emit(items.isEmpty ? const NewsEmpty() : NewsLoaded(items));
      },
    );
  }

  /// Qayta yuklaydi ("Qayta urinish" tugmasi).
  Future<void> reload({int limit = 5}) => load(limit: limit);
}
