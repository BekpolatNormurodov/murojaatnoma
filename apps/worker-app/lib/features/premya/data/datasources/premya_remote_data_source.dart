import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/premya/domain/entities/bonus_request.dart';

/// Premya ("mukofot so'rash") moduli uchun masofaviy ma'lumot manbai.
///
/// Jonli backend kontrakti:
/// - `POST /premya { amount?, reason } -> BonusRequest` (`JwtAuthGuard`,
///   xodim `@CurrentUser`dan olinadi).
/// - `GET /premya/me -> BonusRequest[]` (eng yangisi birinchi).
abstract class PremyaRemoteDataSource {
  Future<BonusRequest> submit({required String reason, int? amount});

  Future<List<BonusRequest>> myRequests();
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. Xotirada oddiy ro'yxat sifatida saqlaydi.
class PremyaRemoteDataSourceMockImpl implements PremyaRemoteDataSource {
  final List<BonusRequest> _items = [];

  @override
  Future<BonusRequest> submit({required String reason, int? amount}) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));

    final created = BonusRequest(
      id: 'PR-${DateTime.now().microsecondsSinceEpoch}',
      amount: amount,
      reason: reason,
      status: BonusRequestStatus.pending,
      createdAt: DateTime.now().toIso8601String(),
    );
    _items.insert(0, created);
    return created;
  }

  @override
  Future<List<BonusRequest>> myRequests() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return List.unmodifiable(_items);
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class PremyaRemoteDataSourceApiImpl implements PremyaRemoteDataSource {
  PremyaRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<BonusRequest> submit({required String reason, int? amount}) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/premya',
        data: {'amount': amount, 'reason': reason},
      );
      return BonusRequest.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<List<BonusRequest>> myRequests() async {
    try {
      final response = await _client.dio.get<List<dynamic>>('/premya/me');
      final data = response.data ?? const [];
      return data
          .map((e) => BonusRequest.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
