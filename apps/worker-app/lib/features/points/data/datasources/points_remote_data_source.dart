import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/mock/mock_points.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';

/// Ball nazorati moduli uchun masofaviy ma'lumot manbai.
abstract class PointsRemoteDataSource {
  Future<WorkerPoints> current();

  Future<List<PointsEntry>> history();
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_points.dart`dagi xotiradagi
/// qiymatlar bilan ishlaydi.
class PointsRemoteDataSourceMockImpl implements PointsRemoteDataSource {
  @override
  Future<WorkerPoints> current() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return mockWorkerPoints;
  }

  @override
  Future<List<PointsEntry>> history() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return List.unmodifiable(mockPointsHistory);
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class PointsRemoteDataSourceApiImpl implements PointsRemoteDataSource {
  PointsRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<WorkerPoints> current() async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/points/me',
      );
      return WorkerPoints.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<List<PointsEntry>> history() async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/points/me/history',
      );
      final data = response.data ?? const [];
      return data
          .map((e) => PointsEntry.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
