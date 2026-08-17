part of 'news_cubit.dart';

/// "Yangiliklar" ro'yxat sahifasining barcha holatlari.
///
/// `sealed` — `NewsPage`dagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi (`MeetingsState` bilan bir xil naqsh).
sealed class NewsState extends Equatable {
  const NewsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda — ro'yxat skeleton (`AppSkeletonList`)
/// ko'rsatadi.
class NewsLoading extends NewsState {
  const NewsLoading();
}

/// Yangiliklar ro'yxati muvaffaqiyatli yuklandi va bo'sh emas.
class NewsLoaded extends NewsState {
  const NewsLoaded(this.items);

  final List<NewsItem> items;

  @override
  List<Object?> get props => [items];
}

/// Hozircha nashr etilgan yangilik yo'q.
class NewsEmpty extends NewsState {
  const NewsEmpty();
}

/// Ro'yxatni yuklashda xatolik (server yoki kutilmagan) — [message]
/// "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class NewsError extends NewsState {
  const NewsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
