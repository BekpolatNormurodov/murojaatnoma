// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/documents/data/datasources/documents_remote_data_source.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';
import 'package:worker_app/features/documents/domain/repositories/documents_repository.dart';

/// `DocumentsRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class DocumentsRepositoryImpl implements DocumentsRepository {
  DocumentsRepositoryImpl({required this.remote});

  final DocumentsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<DocumentItem>>> list({
    DocumentType? type,
    DocumentStatus? status,
  }) async {
    try {
      final result = await remote.list(type: type, status: status);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, DocumentItem>> getById(String id) async {
    try {
      final result = await remote.getById(id);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
