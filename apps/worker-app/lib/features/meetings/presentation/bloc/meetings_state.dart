part of 'meetings_cubit.dart';

/// "Majlislar" ro'yxat sahifasining barcha holatlari.
///
/// `sealed` — `MeetingsPage`dagi `switch` ifodasi compiler tomonidan
/// to'liq (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni
/// ko'rsatishni unutib qoldirish kompilyatsiya xatosiga aylanadi —
/// "hech qachon oq/bo'sh ekran" mandatining bir qismi.
sealed class MeetingsState extends Equatable {
  const MeetingsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (yoki tab o'zgarib qayta yuklanganda) — ro'yxat
/// skeleton (`AppSkeletonList`) ko'rsatadi.
class MeetingsLoading extends MeetingsState {
  const MeetingsLoading();
}

/// Majlislar ro'yxati muvaffaqiyatli yuklandi va bo'sh emas.
class MeetingsLoaded extends MeetingsState {
  const MeetingsLoaded(this.items);

  final List<Meeting> items;

  @override
  List<Object?> get props => [items];
}

/// Joriy filtr (tab) bo'yicha hech qanday majlis topilmadi.
class MeetingsEmpty extends MeetingsState {
  const MeetingsEmpty();
}

/// Ro'yxatni yuklashda xatolik (server yoki kutilmagan) — [message]
/// "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class MeetingsError extends MeetingsState {
  const MeetingsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
