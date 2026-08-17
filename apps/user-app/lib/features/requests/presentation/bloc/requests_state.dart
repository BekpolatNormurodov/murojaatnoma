part of 'requests_cubit.dart';

/// "Murojaatlarim" ro'yxat sahifasining barcha holatlari.
///
/// `sealed` — `RequestsPage`dagi `switch` ifodasi compiler tomonidan
/// to'liq (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni
/// ko'rsatishni unutib qoldirish kompilyatsiya xatosiga aylanadi — "hech
/// qachon oq/bo'sh ekran" mandatining bir qismi.
sealed class RequestsState extends Equatable {
  const RequestsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (yoki tab/qidiruv/filtr o'zgarib qayta
/// yuklanganda) — ro'yxat skeleton (`AppSkeletonList`) ko'rsatadi.
class RequestsLoading extends RequestsState {
  const RequestsLoading();
}

/// Murojaatlar ro'yxati muvaffaqiyatli yuklandi va bo'sh emas.
class RequestsLoaded extends RequestsState {
  const RequestsLoaded(this.items);

  final List<CitizenRequest> items;

  @override
  List<Object?> get props => [items];
}

/// Joriy filtrlar (tur/qidiruv/holat) bo'yicha hech qanday murojaat
/// topilmadi.
class RequestsEmpty extends RequestsState {
  const RequestsEmpty();
}

/// Ro'yxatni yuklashda xatolik (server yoki kutilmagan) — [message]
/// "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class RequestsError extends RequestsState {
  const RequestsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
