part of 'news_detail_cubit.dart';

/// "Yangilik tafsilotlari" sahifasining barcha holatlari.
sealed class NewsDetailState extends Equatable {
  const NewsDetailState();

  @override
  List<Object?> get props => [];
}

/// Yangilik yuklanmoqda (yoki qayta yuklanmoqda — "Qayta urinish").
class NewsDetailLoading extends NewsDetailState {
  const NewsDetailLoading();
}

/// Yangilik muvaffaqiyatli yuklandi.
class NewsDetailLoaded extends NewsDetailState {
  const NewsDetailLoaded(this.item);

  final NewsItem item;

  @override
  List<Object?> get props => [item];
}

/// Yangilikni yuklashda xatolik (masalan topilmadi/server xatosi) —
/// [message] "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class NewsDetailError extends NewsDetailState {
  const NewsDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
