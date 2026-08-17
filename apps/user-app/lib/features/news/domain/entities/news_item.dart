import 'package:equatable/equatable.dart';

/// Bitta yangilik/e'lon — bosh sahifadagi "E'lonlar" bo'limida va (bosilsa)
/// tafsilotlar sahifasida ko'rsatiladigan asosiy domen obyekti.
///
/// Backend `GET https://murojaatnoma.uz/api/news` (`@Public`, tokensiz)
/// qaytaradigan shakl bilan mos. `fromJson` HAR BIR maydonga nisbatan
/// himoyalangan (`as String?`/`as num?` + fallback) — server javobi
/// kutilmagan shaklda (masalan bo'sh/`null` maydon) bo'lsa ham hech qachon
/// qulamaydi (`CitizenRequest.fromJson` bilan bir xil ehtiyotkorlik
/// darajasi, lekin bu yerda BARCHA maydonlar ixtiyoriy deb qaraladi).
class NewsItem extends Equatable {
  const NewsItem({
    required this.id,
    required this.title,
    required this.excerpt,
    required this.body,
    required this.category,
    required this.status,
    required this.cover,
    required this.author,
    required this.publishedAt,
    required this.views,
    required this.featured,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    return NewsItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      excerpt: json['excerpt'] as String? ?? '',
      body: json['body'] as String? ?? '',
      category: json['category'] as String? ?? '',
      status: json['status'] as String? ?? 'published',
      cover: json['cover'] as String? ?? '',
      author: json['author'] as String? ?? '',
      publishedAt: json['publishedAt'] as String? ?? '',
      // `views` JSON'da int yoki double kelishi mumkin — `num` orqali
      // xavfsiz (int-safe) o'qiladi.
      views: (json['views'] as num?)?.toInt() ?? 0,
      featured: json['featured'] as bool? ?? false,
    );
  }

  final String id;
  final String title;

  /// Karta ko'rinishida ko'rsatiladigan qisqa tavsif.
  final String excerpt;

  /// Tafsilotlar sahifasida ko'rsatiladigan to'liq matn.
  final String body;

  /// Turkum (masalan `elon`, `tadbir`, `qaror`, `ogohlantirish`,
  /// `yangilik`) — backenddan xom satr sifatida keladi; foydalanuvchiga
  /// ko'rsatsa bo'ladigan nomga taqdimot qatlamida (`news_section.dart`:
  /// `newsCategoryLabel`) o'giriladi.
  final String category;

  /// Nashr holati (masalan `published`/`draft`) — faqat `published`
  /// bo'lganlari fuqarolarga ko'rsatiladi (qarang: `NewsRepositoryImpl.
  /// latest`, [isPublished]).
  final String status;

  /// Muqova rasmi URL manzili — bo'sh bo'lishi mumkin.
  final String cover;
  final String author;

  /// Nashr sanasi (ISO-8601 satr).
  final String publishedAt;
  final int views;

  /// `true` bo'lsa — tanlangan/muhim yangilik (hozircha UI'da alohida
  /// ishlatilmaydi).
  final bool featured;

  /// `true` — [status] "published" (katta-kichik harfga sezgir emas,
  /// bo'sh joylardan tozalanadi).
  bool get isPublished => status.trim().toLowerCase() == 'published';

  /// [publishedAt]ni `DateTime`ga aylantiradi — parslab bo'lmasa `null`.
  DateTime? get publishedAtDate => DateTime.tryParse(publishedAt);

  @override
  List<Object?> get props => [
    id,
    title,
    excerpt,
    body,
    category,
    status,
    cover,
    author,
    publishedAt,
    views,
    featured,
  ];

  /// `CacheService.setJson`/`getJsonList` orqali keshda saqlash uchun.
  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'excerpt': excerpt,
    'body': body,
    'category': category,
    'status': status,
    'cover': cover,
    'author': author,
    'publishedAt': publishedAt,
    'views': views,
    'featured': featured,
  };
}
