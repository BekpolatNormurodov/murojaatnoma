import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/mock/mock_salaries.dart';
import 'package:worker_app/features/salary/domain/entities/salary.dart';

/// "Oyliklarim" moduli uchun masofaviy ma'lumot manbai.
// ignore: one_member_abstracts
abstract class SalaryRemoteDataSource {
  /// Xodimning o'z oylik maosh tarixi (eng yangi oy birinchi).
  Future<List<Salary>> mine();
}

/// Mock implementatsiya (backend tayyor bo'lguncha / demo rejimida) —
/// [AppConfig.useMock] `true` bo'lganda ishlatiladi. `mock_salaries.dart`dagi
/// xotiradagi qiymatlar bilan ishlaydi (`PointsRemoteDataSourceMockImpl`
/// bilan bir xil naqsh).
class SalaryRemoteDataSourceMockImpl implements SalaryRemoteDataSource {
  @override
  Future<List<Salary>> mine() async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return List.unmodifiable(mockSalaries);
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali `GET /salaries/me`
/// (`points/me` bilan bir xil naqsh; auth interceptor tokenni avtomatik
/// qo'shadi, backend `employeeId`ni token'dan oladi).
class SalaryRemoteDataSourceApiImpl implements SalaryRemoteDataSource {
  SalaryRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Salary>> mine() async {
    try {
      final response = await _client.dio.get<List<dynamic>>('/salaries/me');
      final data = response.data ?? const [];
      return data
          .map((e) => Salary.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
