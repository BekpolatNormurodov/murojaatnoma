import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';

/// Hokimiyat hujjatlari moduli bilan ishlash uchun shartnoma — ro'yxatni
/// (tur/holat bo'yicha filtrlash bilan) o'qish va bitta hujjatni olish.
abstract class DocumentsRepository {
  /// Hujjatlar ro'yxatini oladi.
  ///
  /// [type]/[status] — berilsa, mos ravishda hujjat turi/holati bo'yicha
  /// filtrlaydi (backend `GET /documents` so'rov parametrlarini
  /// qo'llab-quvvatlamagani uchun filtr mijoz tomonda qo'llanadi — qarang:
  /// `data/datasources/documents_remote_data_source.dart`).
  Future<Either<Failure, List<DocumentItem>>> list({
    DocumentType? type,
    DocumentStatus? status,
  });

  /// Bitta hujjatni ID bo'yicha oladi.
  Future<Either<Failure, DocumentItem>> getById(String id);
}
