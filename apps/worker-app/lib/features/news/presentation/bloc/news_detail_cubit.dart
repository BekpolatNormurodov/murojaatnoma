import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/news/domain/entities/news_item.dart';
import 'package:worker_app/features/news/domain/usecases/get_news_item.dart';

part 'news_detail_state.dart';

/// "Yangilik tafsilotlari" sahifasini boshqaruvchi Cubit — bitta
/// yangilikni ID bo'yicha yuklaydi.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [NewsDetailError] holatiga aylanadi (`MeetingDetailCubit` bilan bir
/// xil naqsh).
class NewsDetailCubit extends Cubit<NewsDetailState> {
  NewsDetailCubit({required GetNewsItem getNewsItem})
    : _getNewsItem = getNewsItem,
      super(const NewsDetailLoading());

  final GetNewsItem _getNewsItem;

  /// So'nggi [load] bilan chaqirilgan ID — [retry] parametrsiz qayta
  /// yuklay olishi uchun saqlanadi.
  String? _lastId;

  Future<void> load(String id) async {
    _lastId = id;
    emit(const NewsDetailLoading());
    try {
      final result = await _getNewsItem(GetNewsItemParams(id));
      result.fold(
        (failure) => emit(NewsDetailError(failure.message)),
        (item) => emit(NewsDetailLoaded(item)),
      );
    } on Object catch (e) {
      emit(NewsDetailError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan ID bilan qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _lastId;
    return id == null ? Future<void>.value() : load(id);
  }
}
