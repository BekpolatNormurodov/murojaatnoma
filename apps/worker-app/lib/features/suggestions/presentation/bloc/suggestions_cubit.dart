import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';
import 'package:worker_app/features/suggestions/domain/usecases/get_suggestions.dart';
import 'package:worker_app/features/suggestions/domain/usecases/vote_suggestion.dart';

part 'suggestions_state.dart';

/// "Takliflar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// Joriy filtrlarni (`status`/`query`) ichida saqlaydi — shu tufayli
/// [reload] (pull-to-refresh, "Qayta urinish" tugmasi, yoki taklif
/// yaratish sahifasidan qaytgach) parametrsiz chaqirilib, so'nggi
/// ishlatilgan filtrlar bilan qayta so'rov yuboradi (`RequestsCubit`
/// bilan bir xil naqsh).
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [SuggestionsError] holatiga aylanadi.
class SuggestionsCubit extends Cubit<SuggestionsState> {
  SuggestionsCubit({
    required GetSuggestions getSuggestions,
    required VoteSuggestion voteSuggestion,
  }) : _getSuggestions = getSuggestions,
       _voteSuggestion = voteSuggestion,
       super(const SuggestionsLoading());

  final GetSuggestions _getSuggestions;
  final VoteSuggestion _voteSuggestion;

  SuggestionStatus? _status;
  String? _query;

  SuggestionStatus? get statusFilter => _status;
  String? get query => _query;

  /// Takliflar ro'yxatini (berilgan filtrlar bilan) yuklaydi. Har doim
  /// [SuggestionsLoading] bilan boshlanadi — qidiruv/filtr almashganda ham
  /// eski ro'yxat ustida "muzlab qolgan" holat ko'rinmaydi.
  Future<void> load({SuggestionStatus? status, String? query}) async {
    _status = status;
    _query = query;

    emit(const SuggestionsLoading());
    try {
      final result = await _getSuggestions(
        GetSuggestionsParams(status: status, query: query),
      );
      result.fold((failure) => emit(SuggestionsError(failure.message)), (
        items,
      ) {
        emit(
          items.isEmpty ? const SuggestionsEmpty() : SuggestionsLoaded(items),
        );
      });
    } on Object catch (e) {
      emit(SuggestionsError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan filtrlar bilan qayta yuklaydi (pull-to-refresh,
  /// "Qayta urinish" tugmasi, yoki taklif yaratish sahifasidan qaytgach).
  Future<void> reload() => load(status: _status, query: _query);

  /// Taklifga bitta ovoz qo'shadi — joriy ro'yxatdagi mos yozuvni yangi
  /// (ovoz qo'shilgan) qiymat bilan ALMASHTIRADI, butun ro'yxatni qayta
  /// yuklamasdan (scroll pozitsiyasi/holat saqlanadi).
  ///
  /// `SuggestionsLoaded.votingIds` shu `id` uchun amal davomida uni o'z
  /// ichiga oladi — karta shu payt kichik yuklanish ko'rsatkichini
  /// ko'rsatadi va qayta bosishning oldi olinadi.
  ///
  /// Qaytadi: `null` — muvaffaqiyatli; aks holda — ko'rsatiladigan xatolik
  /// matni.
  Future<String?> vote(String id) async {
    final current = state;
    if (current is! SuggestionsLoaded || current.votingIds.contains(id)) {
      return null;
    }

    // `current` — ovoz berishdan OLDINGI holat (`id` `votingIds`da yo'q) —
    // muvaffaqiyatsizlik/kutilmagan xatolikda ANIQ shu holatga qaytish
    // uchun saqlanadi (spinner o'chadi, ro'yxat o'zgarmaydi).
    emit(current.copyWith(votingIds: {...current.votingIds, id}));
    try {
      final result = await _voteSuggestion(VoteSuggestionParams(id));
      return result.fold(
        (failure) {
          emit(current);
          return failure.message;
        },
        (updated) {
          final items = [
            for (final s in current.items)
              if (s.id == updated.id) updated else s,
          ];
          emit(SuggestionsLoaded(items, votingIds: current.votingIds));
          return null;
        },
      );
    } on Object catch (e) {
      emit(current);
      return 'Kutilmagan xatolik: $e';
    }
  }
}
