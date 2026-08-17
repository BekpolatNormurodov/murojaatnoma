part of 'request_detail_cubit.dart';

/// "Murojaat tafsilotlari" sahifasining barcha holatlari.
sealed class RequestDetailState extends Equatable {
  const RequestDetailState();

  @override
  List<Object?> get props => [];
}

/// Murojaat yuklanmoqda (yoki qayta yuklanmoqda — "Qayta urinish").
class RequestDetailLoading extends RequestDetailState {
  const RequestDetailLoading();
}

/// Murojaat muvaffaqiyatli yuklandi.
class RequestDetailLoaded extends RequestDetailState {
  const RequestDetailLoaded(this.request);

  final CitizenRequest request;

  @override
  List<Object?> get props => [request];
}

/// Murojaatni yuklashda xatolik (masalan topilmadi/server xatosi) —
/// [message] "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class RequestDetailError extends RequestDetailState {
  const RequestDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
