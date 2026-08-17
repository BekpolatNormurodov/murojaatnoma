import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/leave/domain/entities/leave_request.dart';
import 'package:worker_app/features/leave/domain/leave_request_validation.dart';

/// Ta'til ("javob so'rash") moduli uchun masofaviy ma'lumot manbai.
///
/// Jonli backend kontrakti:
/// - `POST /leave { type, amount, startDate, startTime?, reason } ->
///   LeaveRequest` (`JwtAuthGuard`, xodim `@CurrentUser`dan olinadi).
/// - `GET /leave/me -> LeaveRequest[]` (eng yangisi birinchi).
abstract class LeaveRemoteDataSource {
  Future<LeaveRequest> submit({
    required LeaveDurationType type,
    required int amount,
    required String startDate,
    required String reason,
    String? startTime,
  });

  Future<List<LeaveRequest>> myRequests();
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. Xotirada oddiy ro'yxat sifatida saqlaydi.
class LeaveRemoteDataSourceMockImpl implements LeaveRemoteDataSource {
  final List<LeaveRequest> _items = [];

  @override
  Future<LeaveRequest> submit({
    required LeaveDurationType type,
    required int amount,
    required String startDate,
    required String reason,
    String? startTime,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));

    final created = LeaveRequest(
      id: 'LV-${DateTime.now().microsecondsSinceEpoch}',
      type: type,
      amount: amount,
      startDate: startDate,
      startTime: startTime,
      reason: reason,
      status: LeaveRequestStatus.pending,
      createdAt: DateTime.now().toIso8601String(),
    );
    _items.insert(0, created);
    return created;
  }

  @override
  Future<List<LeaveRequest>> myRequests() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return List.unmodifiable(_items);
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class LeaveRemoteDataSourceApiImpl implements LeaveRemoteDataSource {
  LeaveRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<LeaveRequest> submit({
    required LeaveDurationType type,
    required int amount,
    required String startDate,
    required String reason,
    String? startTime,
  }) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/leave',
        data: {
          'type': type.name,
          'amount': amount,
          'startDate': startDate,
          'startTime': startTime,
          'reason': reason,
        },
      );
      return LeaveRequest.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<List<LeaveRequest>> myRequests() async {
    try {
      final response = await _client.dio.get<List<dynamic>>('/leave/me');
      final data = response.data ?? const [];
      return data
          .map((e) => LeaveRequest.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
