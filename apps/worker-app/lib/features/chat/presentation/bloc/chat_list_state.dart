part of 'chat_list_cubit.dart';

/// "Chat" tabidagi suhbatlar ro'yxatining barcha holatlari.
///
/// `sealed` — sahifadagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni ko'rsatishni
/// unutib qoldirish kompilyatsiya xatosiga aylanadi — "hech qachon
/// oq/bo'sh ekran" mandatining bir qismi.
sealed class ChatListState extends Equatable {
  const ChatListState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (yoki tab/qidiruv o'zgarib qayta yuklanganda) —
/// ro'yxat skeleton (`AppSkeletonList`) ko'rsatadi.
class ChatListLoading extends ChatListState {
  const ChatListLoading();
}

/// Suhbatlar ro'yxati muvaffaqiyatli yuklandi va bo'sh emas.
class ChatListLoaded extends ChatListState {
  const ChatListLoaded(this.items);

  final List<Conversation> items;

  @override
  List<Object?> get props => [items];
}

/// Joriy filtrlar (tab/qidiruv) bo'yicha hech qanday suhbat topilmadi.
class ChatListEmpty extends ChatListState {
  const ChatListEmpty();
}

/// Ro'yxatni yuklashda xatolik (server yoki kutilmagan) — [message] "Qayta
/// urinish" tugmasi bilan birga ko'rsatiladi.
class ChatListError extends ChatListState {
  const ChatListError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
