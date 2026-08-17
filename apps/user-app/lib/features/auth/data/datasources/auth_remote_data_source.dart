import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:user_app/features/auth/data/models/auth_session_model.dart';

/// Fuqaro auth uchun masofaviy ma'lumot manbai (telefon/OTP oqimi).
abstract class AuthRemoteDataSource {
  Future<void> sendOtp(String phone);

  Future<AuthSessionModel> verifyOtp({
    required String phone,
    required String code,
  });
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi.
class AuthRemoteDataSourceMockImpl implements AuthRemoteDataSource {
  @override
  Future<void> sendOtp(String phone) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (phone.replaceAll(RegExp(r'\D'), '').length < 9) {
      throw AuthException('Telefon raqami noto‘g‘ri');
    }
  }

  @override
  Future<AuthSessionModel> verifyOtp({
    required String phone,
    required String code,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    // Demo: "1111" har doim to'g'ri.
    if (code != '1111') {
      throw AuthException('Kod noto‘g‘ri kiritildi');
    }
    return AuthSessionModel(
      token: 'demo-jwt-${DateTime.now().millisecondsSinceEpoch}',
      userId: 'U-2087',
      name: 'Dilnoza Yusupova',
      phone: phone,
      region: 'Mirzo Ulug‘bek tumani',
    );
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class AuthApiImpl implements AuthRemoteDataSource {
  AuthApiImpl(this._client);

  final DioClient _client;

  @override
  Future<void> sendOtp(String phone) async {
    try {
      await _client.dio.post<dynamic>('/auth/send-otp', data: {'phone': phone});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<AuthSessionModel> verifyOtp({
    required String phone,
    required String code,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/verify',
        data: {'phone': phone, 'code': code},
      );
      return AuthSessionModel.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
