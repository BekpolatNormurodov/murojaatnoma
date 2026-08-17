import 'package:equatable/equatable.dart';

/// Yangilikning turkumi — backend `NewsCategory` (Prisma) enumiga
/// nom bo'yicha AYNAN mos keladi, shuning uchun `NewsItem.fromJson`da
/// alohida moslashtirish kerak emas (`NewsCategory.values.byName`
/// bevosita ishlaydi).
enum NewsCategory { elon, tadbir, qaror, ogohlantirish, yangilik }

/// Yangilikning nashr holati — backend `NewsStatus` enumiga mos.
///
/// Ilova (xodim) tomoni faqat `published` elementlarni ko'rsatadi —
/// `draft` holatidagilar hali web-admin orqali tayyorlanmoqda va
/// e'lon qilinmagan (filtrlash `NewsRemoteDataSource.list()`da
/// bajariladi, `meetings` modulidagi holat filtri bilan bir xil
/// naqsh).
enum NewsStatus { published, draft }

/// Bitta yangilik/e'lon — ro'yxatda va tafsilotlar sahifasida
/// ko'rsatiladigan asosiy domen obyekti.
///
/// Backend `NewsItem` (Prisma modeli, `catalog` moduli) satridagi barcha
/// maydonlarni o'z ichiga oladi — `GET /news` (yalang'och massiv)
/// qaytaradigan shakl bilan bevosita mos (moslashtirish shart emas,
/// `meetings`/`Meeting`dan farqli o'laroq).
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
      id: json['id'] as String,
      title: json['title'] as String,
      excerpt: json['excerpt'] as String,
      body: json['body'] as String,
      category: _categoryFromApi(json['category'] as String?),
      status: _statusFromApi(json['status'] as String?),
      cover: json['cover'] as String? ?? '',
      author: json['author'] as String? ?? '',
      publishedAt: json['publishedAt'] as String,
      views: (json['views'] as num?)?.toInt() ?? 0,
      featured: json['featured'] as bool? ?? false,
    );
  }

  final String id;
  final String title;

  /// Ro'yxat kartasida ko'rsatiladigan qisqa tavsif.
  final String excerpt;

  /// Tafsilotlar sahifasida ko'rsatiladigan to'liq matn.
  final String body;
  final NewsCategory category;
  final NewsStatus status;

  /// Muqova rasmi URL manzili — bo'sh bo'lishi mumkin.
  final String cover;
  final String author;

  /// Nashr sanasi (ISO-8601).
  final String publishedAt;
  final int views;

  /// `true` bo'lsa — tanlangan/muhim yangilik (hozircha UI'da alohida
  /// ishlatilmaydi, lekin keyingi "tanlanganlar" bo'limi uchun saqlanadi).
  final bool featured;

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

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'excerpt': excerpt,
    'body': body,
    'category': category.name,
    'status': status.name,
    'cover': cover,
    'author': author,
    'publishedAt': publishedAt,
    'views': views,
    'featured': featured,
  };
}

/// Backend `category` qiymatini [NewsCategory]ga aylantiradi — tanilmagan
/// qiymat (masalan kelajakda qo'shiladigan yangi turkum) xavfsiz standart
/// ([NewsCategory.yangilik])ga tushadi.
NewsCategory _categoryFromApi(String? raw) {
  return NewsCategory.values.firstWhere(
    (c) => c.name == raw,
    orElse: () => NewsCategory.yangilik,
  );
}

/// Backend `status` qiymatini [NewsStatus]ga aylantiradi — tanilmagan
/// qiymat xavfsiz standart ([NewsStatus.published])ga tushadi.
NewsStatus _statusFromApi(String? raw) {
  return NewsStatus.values.firstWhere(
    (s) => s.name == raw,
    orElse: () => NewsStatus.published,
  );
}

/// Turkum uchun foydalanuvchiga ko'rsatiladigan o'zbekcha nom.
String newsCategoryLabel(NewsCategory category) {
  switch (category) {
    case NewsCategory.elon:
      return "E'lon";
    case NewsCategory.tadbir:
      return 'Tadbir';
    case NewsCategory.qaror:
      return 'Qaror';
    case NewsCategory.ogohlantirish:
      return 'Ogohlantirish';
    case NewsCategory.yangilik:
      return 'Yangilik';
  }
}
