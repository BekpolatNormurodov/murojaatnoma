import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:user_app/core/mock/mock_citizen_requests.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';

/// Fuqaro arizalari/shikoyatlari uchun masofaviy ma'lumot manbai.
abstract class CitizenRequestsRemoteDataSource {
  Future<List<CitizenRequest>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  });

  Future<CitizenRequest> getById(String id);

  Future<CitizenRequest> submit(CitizenRequest draft);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_citizen_requests.dart`dagi
/// xotiradagi ro'yxat bilan ishlaydi.
class CitizenRequestsRemoteDataSourceMockImpl
    implements CitizenRequestsRemoteDataSource {
  @override
  Future<List<CitizenRequest>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<CitizenRequest>.of(mockCitizenRequests);
    if (kind != null) {
      result = result.where((r) => r.kind == kind).toList();
    }
    if (status != null) {
      result = result.where((r) => r.status == status).toList();
    }
    final normalizedQuery = query?.trim().toLowerCase();
    if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
      result = result
          .where(
            (r) =>
                r.title.toLowerCase().contains(normalizedQuery) ||
                r.body.toLowerCase().contains(normalizedQuery) ||
                r.category.toLowerCase().contains(normalizedQuery),
          )
          .toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<CitizenRequest> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockCitizenRequests.indexWhere((r) => r.id == id);
    if (index == -1) throw ServerException('Murojaat topilmadi: $id');
    return mockCitizenRequests[index];
  }

  @override
  Future<CitizenRequest> submit(CitizenRequest draft) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));

    if (draft.title.trim().isEmpty ||
        draft.body.trim().isEmpty ||
        draft.category.trim().isEmpty) {
      throw ServerException("Barcha majburiy maydonlarni to'ldiring");
    }

    final created = CitizenRequest(
      id: 'CR-${DateTime.now().millisecondsSinceEpoch}',
      kind: draft.kind,
      category: draft.category,
      title: draft.title.trim(),
      body: draft.body.trim(),
      status: RequestStatus.yuborilgan,
      createdAt: DateTime.now().toIso8601String(),
      attachments: draft.attachments,
    );
    mockCitizenRequests.insert(0, created);
    return created;
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class CitizenRequestsApiImpl implements CitizenRequestsRemoteDataSource {
  CitizenRequestsApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<CitizenRequest>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/citizen-requests',
        queryParameters: {
          if (kind != null) 'kind': kind.name,
          if (status != null) 'status': status.name,
          if (query != null && query.isNotEmpty) 'query': query,
        },
      );
      final data = response.data ?? const [];
      return data
          .map((e) => CitizenRequest.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<CitizenRequest> getById(String id) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/citizen-requests/$id',
      );
      return CitizenRequest.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<CitizenRequest> submit(CitizenRequest draft) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/citizen-requests',
        data: draft.toJson(),
      );
      return CitizenRequest.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
