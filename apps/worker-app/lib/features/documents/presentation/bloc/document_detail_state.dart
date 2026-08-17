part of 'document_detail_cubit.dart';

/// "Hujjat tafsilotlari" sahifasining barcha holatlari.
sealed class DocumentDetailState extends Equatable {
  const DocumentDetailState();

  @override
  List<Object?> get props => [];
}

/// Hujjat yuklanmoqda (yoki qayta yuklanmoqda — "Qayta urinish").
class DocumentDetailLoading extends DocumentDetailState {
  const DocumentDetailLoading();
}

/// Hujjat muvaffaqiyatli yuklandi.
class DocumentDetailLoaded extends DocumentDetailState {
  const DocumentDetailLoaded(this.document);

  final DocumentItem document;

  @override
  List<Object?> get props => [document];
}

/// Hujjatni yuklashda xatolik (masalan topilmadi/server xatosi) —
/// [message] "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class DocumentDetailError extends DocumentDetailState {
  const DocumentDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
