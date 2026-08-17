import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/domain/usecases/get_documents.dart';

part 'documents_state.dart';

/// "Hujjatlar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// Joriy tur/holat filtrlarini ichida saqlaydi — shu tufayli [reload]
/// (pull-to-refresh yoki "Qayta urinish") parametrsiz chaqirilib, so'nggi
/// ishlatilgan filtrlar bilan qayta so'rov yuboradi (`RequestsCubit`/
/// `MeetingsCubit` bilan bir xil naqsh).
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [DocumentsError] holatiga aylanadi.
class DocumentsCubit extends Cubit<DocumentsState> {
  DocumentsCubit({required GetDocuments getDocuments})
    : _getDocuments = getDocuments,
      super(const DocumentsLoading());

  final GetDocuments _getDocuments;

  DocumentType? _type;
  DocumentStatus? _status;

  DocumentType? get typeFilter => _type;
  DocumentStatus? get statusFilter => _status;

  /// `true` bo'lsa tur yoki holat filtridan biri tanlangan — filtr
  /// tugmasining faol-holat ko'rsatkichi uchun.
  bool get hasActiveFilters => _type != null || _status != null;

  /// Hujjatlar ro'yxatini (berilgan tur/holat filtrlari bilan) yuklaydi.
  /// Har doim [DocumentsLoading] bilan boshlanadi — filtr almashganda ham
  /// eski ro'yxat ustida "muzlab qolgan" holat ko'rinmaydi.
  Future<void> load({DocumentType? type, DocumentStatus? status}) async {
    _type = type;
    _status = status;

    emit(const DocumentsLoading());
    try {
      final result = await _getDocuments(
        GetDocumentsParams(type: type, status: status),
      );
      result.fold((failure) => emit(DocumentsError(failure.message)), (
        items,
      ) {
        emit(items.isEmpty ? const DocumentsEmpty() : DocumentsLoaded(items));
      });
    } on Object catch (e) {
      emit(DocumentsError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan filtrlar bilan qayta yuklaydi (pull-to-refresh,
  /// "Qayta urinish" tugmasi).
  Future<void> reload() => load(type: _type, status: _status);
}
