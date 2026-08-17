import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/domain/repositories/documents_repository.dart';

/// Bitta hujjatni ID bo'yicha olish (tafsilotlar sahifasi uchun).
class GetDocument implements UseCase<DocumentItem, GetDocumentParams> {
  GetDocument(this.repository);

  final DocumentsRepository repository;

  @override
  Future<Either<Failure, DocumentItem>> call(GetDocumentParams params) {
    return repository.getById(params.id);
  }
}

/// [GetDocument] uchun kirish parametri.
class GetDocumentParams extends Equatable {
  const GetDocumentParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
