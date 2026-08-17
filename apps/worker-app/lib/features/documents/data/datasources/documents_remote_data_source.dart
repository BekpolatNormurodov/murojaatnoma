import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/documents/data/datasources/mock_documents.dart';
import 'package:worker_app/features/documents/domain/entities/document_item.dart';

/// Hokimiyat hujjatlari moduli uchun masofaviy ma'lumot manbai.
abstract class DocumentsRemoteDataSource {
  Future<List<DocumentItem>> list({DocumentType? type, DocumentStatus? status});

  Future<DocumentItem> getById(String id);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_documents.dart`dagi xotiradagi
/// ro'yxat bilan ishlaydi.
class DocumentsRemoteDataSourceMockImpl implements DocumentsRemoteDataSource {
  @override
  Future<List<DocumentItem>> list({
    DocumentType? type,
    DocumentStatus? status,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<DocumentItem>.of(mockDocuments);
    if (type != null) {
      result = result.where((d) => d.type == type).toList();
    }
    if (status != null) {
      result = result.where((d) => d.status == status).toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<DocumentItem> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockDocuments.indexWhere((d) => d.id == id);
    if (index == -1) throw ServerException('Hujjat topilmadi: $id');
    return mockDocuments[index];
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// Backend `GovDocument` (Prisma) satri mobil [DocumentItem] entitisiga
/// TO'G'RIDAN-TO'G'RI mos keladi (maydon nomlari ham camelCase bir xil:
/// `id`, `code`, `title`, `type`, `status`, `author`, `region`,
/// `createdAt`, `sizeKb`, `pages`) — `meetings`/`applications`
/// modullaridan farqli, bu yerda alohida `_adapt*` moslashtiruvchi
/// funksiya SHART EMAS, `DocumentItem.fromJson` xom javobni to'g'ridan-
/// to'g'ri qabul qiladi.
///
/// **Diqqat**: `GET /documents` HECH QANDAY so'rov parametrini
/// qo'llab-quvvatlamaydi (`CatalogController.findDocuments()`
/// argumentsiz, qarang: `apps/backend/src/modules/catalog`) — shuning
/// uchun `type`/`status` filtrlari serverga yuborilmaydi, natija esa
/// moslashtirilgandan keyin mijoz tomonda filtrlanadi (`meetings` moduli
/// bilan bir xil naqsh).
///
/// `GET /documents/:id` endpointi HAM UMUMAN YO'Q (`CatalogController`da
/// faqat `GET/POST /documents` va `PATCH`/`DELETE /documents/:id` bor) —
/// [getById] to'liq ro'yxatni olib, ID bo'yicha mijoz tomonda qidiradi
/// (`meetings` moduli bilan bir xil naqsh).
class DocumentsRemoteDataSourceApiImpl implements DocumentsRemoteDataSource {
  DocumentsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<DocumentItem>> list({
    DocumentType? type,
    DocumentStatus? status,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>('/documents');
      final rows = response.data ?? const [];
      var result = rows
          .map((e) => DocumentItem.fromJson(e as Map<String, dynamic>))
          .toList();
      if (type != null) {
        result = result.where((d) => d.type == type).toList();
      }
      if (status != null) {
        result = result.where((d) => d.status == status).toList();
      }
      return result;
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<DocumentItem> getById(String id) async {
    try {
      // Backendda `GET /documents/:id` YO'Q — shuning uchun to'liq
      // ro'yxat olinadi va ID bo'yicha shu yerda (mijoz tomonda)
      // qidiriladi.
      final response = await _client.dio.get<List<dynamic>>('/documents');
      final rows = response.data ?? const [];
      final index = rows.indexWhere(
        (e) => (e as Map<String, dynamic>)['id'] == id,
      );
      if (index == -1) {
        throw ServerException('Hujjat topilmadi');
      }
      return DocumentItem.fromJson(rows[index] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
