part of 'suggestions_cubit.dart';

/// "Takliflar" ro'yxat sahifasining barcha holatlari.
///
/// `sealed` — `SuggestionsPage`dagi `switch` ifodasi compiler tomonidan
/// to'liq (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni
/// ko'rsatishni unutib qoldirish kompilyatsiya xatosiga aylanadi —
/// "hech qachon oq/bo'sh ekran" mandatining bir qismi.
sealed class SuggestionsState extends Equatable {
  const SuggestionsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (yoki qidiruv/filtr o'zgarib qayta yuklanganda) —
/// ro'yxat skeleton (`AppSkeletonList`) ko'rsatadi.
class SuggestionsLoading extends SuggestionsState {
  const SuggestionsLoading();
}

/// Takliflar ro'yxati muvaffaqiyatli yuklandi va bo'sh emas.
///
/// [votingIds] — hozir ovoz berilayotgan takliflar ID'lari to'plami;
/// mos karta shu payt kichik yuklanish ko'rsatkichini ko'rsatadi va
/// qayta bosishning oldi olinadi.
class SuggestionsLoaded extends SuggestionsState {
  const SuggestionsLoaded(this.items, {this.votingIds = const {}});

  final List<Suggestion> items;
  final Set<String> votingIds;

  SuggestionsLoaded copyWith({
    List<Suggestion>? items,
    Set<String>? votingIds,
  }) {
    return SuggestionsLoaded(
      items ?? this.items,
      votingIds: votingIds ?? this.votingIds,
    );
  }

  @override
  List<Object?> get props => [items, votingIds];
}

/// Joriy filtrlar (holat/qidiruv) bo'yicha hech qanday taklif topilmadi.
class SuggestionsEmpty extends SuggestionsState {
  const SuggestionsEmpty();
}

/// Ro'yxatni yuklashda xatolik (server yoki kutilmagan) — [message]
/// "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class SuggestionsError extends SuggestionsState {
  const SuggestionsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
