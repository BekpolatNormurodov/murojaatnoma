import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/calls/domain/entities/call.dart';

/// Qo'ng'iroq HTTP endpointlari uchun masofaviy ma'lumot manbai:
/// - `GET /rt/ice-servers` -> `{ iceServers: [...] }`.
/// - `GET /calls?limit=` -> `CallLog[]`.
abstract class CallRemoteDataSource {
  Future<List<Map<String, dynamic>>> iceServers();
  Future<List<CallLogEntry>> history({int limit});
}

/// Standart STUN — real endpoint ishlamay qolsa yoki mock rejimda ham
/// qo'ng'iroq ulanaverishi uchun zaxira (kontraktdagi doimiy qiymat).
const List<Map<String, dynamic>> kDefaultIceServers = [
  {'urls': 'stun:stun.l.google.com:19302'},
];

/// Mock implementatsiya — backend yo'q rejimda standart STUN va bo'sh
/// tarix qaytaradi (qo'ng'iroq oqimi mock'da ishlamaydi, lekin ilova
/// qulamaydi).
class CallRemoteDataSourceMockImpl implements CallRemoteDataSource {
  @override
  Future<List<Map<String, dynamic>>> iceServers() async => kDefaultIceServers;

  @override
  Future<List<CallLogEntry>> history({int limit = 50}) async => const [];
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class CallRemoteDataSourceApiImpl implements CallRemoteDataSource {
  CallRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Map<String, dynamic>>> iceServers() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/rt/ice-servers',
      );
      final raw = response.data?['iceServers'];
      if (raw is List) {
        return raw
            .whereType<Map<dynamic, dynamic>>()
            .map(Map<String, dynamic>.from)
            .toList();
      }
      return kDefaultIceServers;
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'ICE serverlarni olishda xatolik');
    }
  }

  @override
  Future<List<CallLogEntry>> history({int limit = 50}) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/calls',
        queryParameters: {'limit': limit},
      );
      final data = response.data ?? const [];
      return data
          .whereType<Map<dynamic, dynamic>>()
          .map((e) => CallLogEntry.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? "Qo'ng'iroqlar tarixida xatolik");
    }
  }
}
