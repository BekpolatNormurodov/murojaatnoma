part of 'news_cubit.dart';

/// Bosh sahifadagi "E'lonlar" bo'limining barcha holatlari.
///
/// `sealed` — `NewsSection`dagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi (`HomeState` bilan bir xil naqsh).
sealed class NewsState extends Equatable {
  const NewsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (kesh bo'lmasa) — bo'lim skeleton ko'rsatadi.
class NewsLoading extends NewsState {
  const NewsLoading();
}

/// E'lonlar muvaffaqiyatli yuklandi (kamida bitta yozuv bilan).
class NewsLoaded extends NewsState {
  const NewsLoaded(this.items);

  final List<NewsItem> items;

  @override
  List<Object?> get props => [items];
}

/// Hozircha nashr etilgan e'lon yo'q.
class NewsEmpty extends NewsState {
  const NewsEmpty();
}

/// Yuklashda xatolik (server yoki kutilmagan) — [message] "Qayta urinish"
/// tugmasi bilan ko'rsatiladi.
class NewsError extends NewsState {
  const NewsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
