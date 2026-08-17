import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/mock/mock_meetings.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';

/// Majlislar (yig'ilishlar) moduli uchun masofaviy ma'lumot manbai.
abstract class MeetingsRemoteDataSource {
  Future<List<Meeting>> list({MeetingStatus? status});

  Future<Meeting> getById(String id);

  Future<Meeting> join(String id);
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_meetings.dart`dagi xotiradagi
/// ro'yxat bilan ishlaydi.
class MeetingsRemoteDataSourceMockImpl implements MeetingsRemoteDataSource {
  @override
  Future<List<Meeting>> list({MeetingStatus? status}) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<Meeting>.of(mockMeetings);
    if (status != null) {
      result = result.where((m) => m.status == status).toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<Meeting> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockMeetings.indexWhere((m) => m.id == id);
    if (index == -1) throw ServerException('Majlis topilmadi: $id');
    return mockMeetings[index];
  }

  @override
  Future<Meeting> join(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final index = mockMeetings.indexWhere((m) => m.id == id);
    if (index == -1) throw ServerException('Majlis topilmadi: $id');

    final existing = mockMeetings[index];
    final updated = _withUpdate(
      existing,
      joinUrl: existing.joinUrl ?? 'https://meet.hokimiyat.uz/${existing.id}',
    );
    mockMeetings[index] = updated;
    return updated;
  }
}

/// Mavjud [Meeting]dan ba'zi maydonlarini almashtirib, yangisini yaratadi.
/// `join` mock mutatsiyasi uchun ichki yordamchi — domen entitisi
/// (`Meeting`) o'zida ochiq `copyWith` olib yurmasligi uchun shu yerda
/// (data qatlamida) xususiy saqlangan.
Meeting _withUpdate(Meeting source, {String? joinUrl}) {
  return Meeting(
    id: source.id,
    title: source.title,
    description: source.description,
    startAt: source.startAt,
    durationMin: source.durationMin,
    host: source.host,
    participants: source.participants,
    status: source.status,
    joinUrl: joinUrl ?? source.joinUrl,
  );
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class MeetingsRemoteDataSourceApiImpl implements MeetingsRemoteDataSource {
  MeetingsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Meeting>> list({MeetingStatus? status}) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/meetings',
        queryParameters: {if (status != null) 'status': status.name},
      );
      final data = response.data ?? const [];
      return data
          .map((e) => Meeting.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Meeting> getById(String id) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/meetings/$id',
      );
      return Meeting.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Meeting> join(String id) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/meetings/$id/join',
      );
      return Meeting.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
