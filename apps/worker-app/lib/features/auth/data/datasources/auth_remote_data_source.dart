import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/features/auth/data/models/auth_session_model.dart';

/// Ishchi auth uchun masofaviy ma'lumot manbai (telefon/OTP oqimi).
abstract class AuthRemoteDataSource {
  /// SMS-OTP kod yuborish. Backend `OTP_DEV_ECHO=true` bo'lsa javobda
  /// `devCode`ni ham qaytaradi (real SMS gateway'siz login uchun) — shu
  /// qiymat qaytariladi, aks holda `null`.
  Future<String?> sendOtp(String phone);

  Future<AuthSessionModel> verifyOtp({
    required String phone,
    required String code,
  });
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. Haqiqiy backend'i yo'q, shuning uchun
/// `devCode` doim `null` — mock oqimda hech qanday maslahat/hint
/// ko'rsatilmaydi.
class AuthRemoteDataSourceMockImpl implements AuthRemoteDataSource {
  @override
  Future<String?> sendOtp(String phone) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (phone.replaceAll(RegExp(r'\D'), '').length < 9) {
      throw AuthException('Telefon raqami noto‘g‘ri');
    }
    return null;
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
      workerId: 'W-1042',
      name: 'Sardor Karimov',
      position: 'Kommunal xizmat mutaxassisi',
      region: 'Chilonzor tumani',
    );
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
///
/// Backend kontrakti (`murojaatnoma.uz`):
/// - `POST /auth/request-otp {phone}` -> `{expiresInSeconds, devCode?}`
/// - `POST /auth/verify-otp {phone, code}` ->
///   `{accessToken, refreshToken, expiresIn}`
/// - `GET /auth/me` (Bearer) ->
///   `{id, fullName, phone, position, region, district, role, avatarUrl,
///   hasFace}`
///
/// `verifyOtp` ikkala so'rovni (token olish + profilni o'qish) ICHKARIDA
/// ketma-ket bajaradi va natijani BITTA `AuthSessionModel`ga birlashtiradi
/// — chaqiruvchi (`AuthRepositoryImpl`) uchun bitta atomik operatsiya
/// bo'lib qoladi (interfeys `sendOtp`/`verifyOtp`dan boshqa narsa talab
/// qilmaydi, shuning uchun mock/api seam o'zgarishsiz qoladi).
class AuthApiImpl implements AuthRemoteDataSource {
  AuthApiImpl(this._client);

  final DioClient _client;

  @override
  Future<String?> sendOtp(String phone) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/request-otp',
        data: {'phone': phone},
      );
      // `devCode` faqat backend `OTP_DEV_ECHO=true` bo'lganda (dev/staging)
      // javobda keladi — ishlab chiqarishda (production) maydon umuman
      // yo'q, shuning uchun bu yerda HECH QANDAY qo'shimcha shart kerak
      // emas: `null` bo'lsa yuqori qatlamlar (cubit/UI) hech narsa
      // ko'rsatmaydi — sizib chiqish (leak) ehtimoli yo'q.
      return response.data?['devCode'] as String?;
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
      final verifyResponse = await _client.dio.post<Map<String, dynamic>>(
        '/auth/verify-otp',
        data: {'phone': phone, 'code': code},
      );
      final tokens = verifyResponse.data ?? const <String, dynamic>{};
      final accessToken = tokens['accessToken'] as String?;
      if (accessToken == null || accessToken.isEmpty) {
        throw AuthException('Server tokensiz javob qaytardi');
      }
      final refreshToken = tokens['refreshToken'] as String?;

      // `AuthInterceptor` yangi tokenni hali bilmaydi — u faqat
      // `SharedPreferences`dan o'qiydi va bu yerga ULGURMAYDI (token shu
      // yerdan qaytgach, `AuthRepositoryImpl.verifyOtp` uni saqlaydi).
      // Shuning uchun `/auth/me`ga Bearer sarlavhasi QO'LDA beriladi.
      final meResponse = await _client.dio.get<Map<String, dynamic>>(
        '/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
      );
      final me = meResponse.data ?? const <String, dynamic>{};

      return AuthSessionModel(
        token: accessToken,
        refreshToken: refreshToken,
        workerId: me['id'] as String? ?? '',
        name: me['fullName'] as String? ?? '',
        position: me['position'] as String? ?? '',
        region: me['region'] as String? ?? '',
        phone: me['phone'] as String?,
        district: me['district'] as String?,
        role: me['role'] as String?,
        avatarUrl: me['avatarUrl'] as String?,
        hasFace: me['hasFace'] as bool? ?? false,
      );
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
