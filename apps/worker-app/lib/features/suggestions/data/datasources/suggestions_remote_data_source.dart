import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/mock/mock_suggestions.dart';
import 'package:worker_app/features/suggestions/domain/entities/suggestion.dart';

/// Takliflar (ratsionalizatorlik g'oyalari) moduli uchun masofaviy
/// ma'lumot manbai.
abstract class SuggestionsRemoteDataSource {
  Future<List<Suggestion>> list({SuggestionStatus? status, String? query});

  Future<Suggestion> submit(Suggestion draft);

  Future<Suggestion> vote(String id);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_suggestions.dart`dagi xotiradagi
/// ro'yxat bilan ishlaydi.
class SuggestionsRemoteDataSourceMockImpl
    implements SuggestionsRemoteDataSource {
  @override
  Future<List<Suggestion>> list({
    SuggestionStatus? status,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<Suggestion>.of(mockSuggestions);
    if (status != null) {
      result = result.where((s) => s.status == status).toList();
    }
    final normalizedQuery = query?.trim().toLowerCase();
    if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
      result = result
          .where(
            (s) =>
                s.title.toLowerCase().contains(normalizedQuery) ||
                s.body.toLowerCase().contains(normalizedQuery) ||
                s.category.toLowerCase().contains(normalizedQuery),
          )
          .toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<Suggestion> submit(Suggestion draft) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    final created = Suggestion(
      id: 'TKL-${DateTime.now().microsecondsSinceEpoch}',
      title: draft.title,
      body: draft.body,
      category: draft.category,
      status: SuggestionStatus.yangi,
      createdAt: DateTime.now().toIso8601String(),
      votes: 0,
    );
    mockSuggestions.add(created);
    return created;
  }

  @override
  Future<Suggestion> vote(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockSuggestions.indexWhere((s) => s.id == id);
    if (index == -1) throw ServerException('Taklif topilmadi: $id');

    final existing = mockSuggestions[index];
    final updated = Suggestion(
      id: existing.id,
      title: existing.title,
      body: existing.body,
      category: existing.category,
      status: existing.status,
      createdAt: existing.createdAt,
      votes: existing.votes + 1,
    );
    mockSuggestions[index] = updated;
    return updated;
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class SuggestionsRemoteDataSourceApiImpl
    implements SuggestionsRemoteDataSource {
  SuggestionsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Suggestion>> list({
    SuggestionStatus? status,
    String? query,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/suggestions',
        queryParameters: {
          if (status != null) 'status': status.name,
          if (query != null && query.isNotEmpty) 'query': query,
        },
      );
      final data = response.data ?? const [];
      return data
          .map((e) => Suggestion.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Suggestion> submit(Suggestion draft) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/suggestions',
        data: draft.toJson(),
      );
      return Suggestion.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Suggestion> vote(String id) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/suggestions/$id/vote',
      );
      return Suggestion.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
