import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';
import 'package:worker_app/features/news/domain/usecases/get_news_list.dart';

part 'news_state.dart';

/// "Yangiliklar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [NewsError] holatiga aylanadi (`MeetingsCubit` bilan bir xil naqsh).
class NewsCubit extends Cubit<NewsState> {
  NewsCubit({required GetNewsList getNewsList})
    : _getNewsList = getNewsList,
      super(const NewsLoading());

  final GetNewsList _getNewsList;

  /// Yangiliklar ro'yxatini yuklaydi. Har doim [NewsLoading] bilan
  /// boshlanadi — sahifa qayta ochilganda eski ro'yxat ustida "muzlab
  /// qolgan" holat ko'rinmaydi.
  Future<void> load() async {
    emit(const NewsLoading());
    try {
      final result = await _getNewsList(const NoParams());
      result.fold((failure) => emit(NewsError(failure.message)), (items) {
        emit(items.isEmpty ? const NewsEmpty() : NewsLoaded(items));
      });
    } on Object catch (e) {
      emit(NewsError('Kutilmagan xatolik: $e'));
    }
  }

  /// Qayta yuklaydi (pull-to-refresh, "Qayta urinish" tugmasi).
  Future<void> reload() => load();
}
