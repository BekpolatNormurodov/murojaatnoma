import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/domain/repositories/documents_repository.dart';

/// Hujjatlar ro'yxatini (ixtiyoriy tur/holat filtri bilan) olish.
class GetDocuments implements UseCase<List<DocumentItem>, GetDocumentsParams> {
  GetDocuments(this.repository);

  final DocumentsRepository repository;

  @override
  Future<Either<Failure, List<DocumentItem>>> call(
    GetDocumentsParams params,
  ) {
    return repository.list(type: params.type, status: params.status);
  }
}

/// [GetDocuments] uchun filtr parametri.
class GetDocumentsParams extends Equatable {
  const GetDocumentsParams({this.type, this.status});

  final DocumentType? type;
  final DocumentStatus? status;

  @override
  List<Object?> get props => [type, status];
}
