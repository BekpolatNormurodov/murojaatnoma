import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/domain/usecases/get_document.dart';

part 'document_detail_state.dart';

/// "Hujjat tafsilotlari" sahifasini boshqaruvchi Cubit — bitta hujjatni
/// ID bo'yicha yuklaydi.
///
/// Hech qachon uncaught tashlamaydi: [load] muvaffaqiyatsizligi
/// [DocumentDetailError] holatiga aylanadi (`MeetingDetailCubit` bilan
/// bir xil naqsh).
class DocumentDetailCubit extends Cubit<DocumentDetailState> {
  DocumentDetailCubit({required GetDocument getDocument})
    : _getDocument = getDocument,
      super(const DocumentDetailLoading());

  final GetDocument _getDocument;

  /// So'nggi [load] bilan chaqirilgan ID — [retry] parametrsiz qayta
  /// yuklay olishi uchun saqlanadi.
  String? _lastId;

  Future<void> load(String id) async {
    _lastId = id;
    emit(const DocumentDetailLoading());
    try {
      final result = await _getDocument(GetDocumentParams(id));
      result.fold(
        (failure) => emit(DocumentDetailError(failure.message)),
        (document) => emit(DocumentDetailLoaded(document)),
      );
    } on Object catch (e) {
      emit(DocumentDetailError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan ID bilan qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _lastId;
    return id == null ? Future<void>.value() : load(id);
  }
}
