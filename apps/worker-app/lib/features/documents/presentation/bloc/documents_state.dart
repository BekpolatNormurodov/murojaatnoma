part of 'documents_cubit.dart';

/// "Hujjatlar" ro'yxat sahifasining barcha holatlari.
///
/// `sealed` — `DocumentsPage`dagi `switch` ifodasi compiler tomonidan
/// to'liq (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni
/// ko'rsatishni unutib qoldirish kompilyatsiya xatosiga aylanadi —
/// "hech qachon oq/bo'sh ekran" mandatining bir qismi.
sealed class DocumentsState extends Equatable {
  const DocumentsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (yoki filtr o'zgarib qayta yuklanganda) —
/// ro'yxat skeleton (`AppSkeletonList`) ko'rsatadi.
class DocumentsLoading extends DocumentsState {
  const DocumentsLoading();
}

/// Hujjatlar ro'yxati muvaffaqiyatli yuklandi va bo'sh emas.
class DocumentsLoaded extends DocumentsState {
  const DocumentsLoaded(this.items);

  final List<DocumentItem> items;

  @override
  List<Object?> get props => [items];
}

/// Joriy filtrlar (tur/holat) bo'yicha hech qanday hujjat topilmadi.
class DocumentsEmpty extends DocumentsState {
  const DocumentsEmpty();
}

/// Ro'yxatni yuklashda xatolik (server yoki kutilmagan) — [message]
/// "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class DocumentsError extends DocumentsState {
  const DocumentsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
