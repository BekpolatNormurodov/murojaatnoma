import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/mock/mock_applications.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';

/// Fuqarolar murojaatlari (arizalar) uchun masofaviy ma'lumot manbai.
abstract class ApplicationsRemoteDataSource {
  Future<List<Application>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  });

  Future<Application> getById(String id);

  Future<Application> respond(String id, ApplicationResponse response);

  Future<Application> rate(String id, int points);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_applications.dart`dagi
/// xotiradagi ro'yxat bilan ishlaydi.
class ApplicationsRemoteDataSourceMockImpl
    implements ApplicationsRemoteDataSource {
  @override
  Future<List<Application>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<Application>.of(mockApplications);
    if (assignedOnly) {
      result = result.where((a) => a.assignedToMe).toList();
    }
    if (status != null) {
      result = result.where((a) => a.status == status).toList();
    }
    final normalizedQuery = query?.trim().toLowerCase();
    if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
      result = result
          .where(
            (a) =>
                a.title.toLowerCase().contains(normalizedQuery) ||
                a.description.toLowerCase().contains(normalizedQuery) ||
                a.category.toLowerCase().contains(normalizedQuery),
          )
          .toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<Application> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockApplications.indexWhere((a) => a.id == id);
    if (index == -1) throw ServerException('Ariza topilmadi: $id');
    return mockApplications[index];
  }

  @override
  Future<Application> respond(String id, ApplicationResponse response) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final index = mockApplications.indexWhere((a) => a.id == id);
    if (index == -1) throw ServerException('Ariza topilmadi: $id');
    final updated = _withUpdate(
      mockApplications[index],
      status: ApplicationStatus.javobBerildi,
      response: response,
    );
    mockApplications[index] = updated;
    return updated;
  }

  @override
  Future<Application> rate(String id, int points) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockApplications.indexWhere((a) => a.id == id);
    if (index == -1) throw ServerException('Ariza topilmadi: $id');
    final updated = _withUpdate(mockApplications[index], points: points);
    mockApplications[index] = updated;
    return updated;
  }
}

/// Mavjud [Application]dan ba'zi maydonlarini almashtirib, yangisini
/// yaratadi. `respond`/`rate` mock mutatsiyalari uchun ichki yordamchi —
/// domen entitisi (`Application`) o'zida ochiq `copyWith` olib
/// yurmasligi uchun shu yerda (data qatlamida) xususiy saqlangan.
Application _withUpdate(
  Application source, {
  ApplicationStatus? status,
  int? points,
  ApplicationResponse? response,
}) {
  return Application(
    id: source.id,
    title: source.title,
    description: source.description,
    category: source.category,
    status: status ?? source.status,
    priority: source.priority,
    createdAt: source.createdAt,
    deadline: source.deadline,
    assignedToMe: source.assignedToMe,
    points: points ?? source.points,
    attachments: source.attachments,
    response: response ?? source.response,
    citizenName: source.citizenName,
    citizenPhone: source.citizenPhone,
  );
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class ApplicationsRemoteDataSourceApiImpl
    implements ApplicationsRemoteDataSource {
  ApplicationsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Application>> list({
    bool assignedOnly = false,
    ApplicationStatus? status,
    String? query,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/applications',
        queryParameters: {
          if (assignedOnly) 'assigned_only': assignedOnly,
          if (status != null) 'status': status.name,
          if (query != null && query.isNotEmpty) 'query': query,
        },
      );
      final data = response.data ?? const [];
      return data
          .map((e) => Application.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Application> getById(String id) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/applications/$id',
      );
      return Application.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Application> respond(String id, ApplicationResponse response) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/applications/$id/respond',
        data: response.toJson(),
      );
      return Application.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Application> rate(String id, int points) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/applications/$id/rate',
        data: {'points': points},
      );
      return Application.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
