import 'dart:convert';

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

/// Telefon raqamini backend kutgan qat'iy E.164 formatga keltiradi (masalan
/// `PhoneInputPage` "`+998 901234567`" — oraliq bo'shliq bilan — uzatadi,
/// backend esa `^\+[1-9]\d{7,14}$` ni talab qiladi — bo'shliqsiz).
String _normalizePhone(String raw) =>
    raw.replaceAll(RegExp('[^0-9+]'), '').trim();

/// Backend (`AuthService`, `apps/backend/src/modules/auth/auth.service.ts`)
/// ba'zi OTP xatolarini xom INGLIZ tilida qaytaradi (masalan
/// `BadRequestException('Invalid OTP code')`) — ular to'g'ridan-to'g'ri
/// ko'rsatilsa fuqaro tushunmaydi. Bu lug'at TANIQLI backend xabarlarini
/// aniq, qisqa o'zbekcha matnga aylantiradi; tanilmagan xabar (masalan
/// telefon validatsiyasi) O'ZGARISHSIZ qoladi (backend matni ko'rsatiladi
/// — umuman xabarsiz qolishdan yaxshiroq).
const _authErrorTranslations = {
  'Invalid OTP code': "Kod noto'g'ri. Qaytadan urinib ko'ring",
  'OTP code expired or not found': "Kod eskirdi. Yangi kod so'rang",
  'Too many incorrect attempts. Request a new code.':
      "Juda ko'p noto'g'ri urinish. Yangi kod so'rang",
  'Employee account is inactive': 'Hisobingiz faol emas',
};

/// `DioException`dan foydalanuvchiga ko'rsatsa bo'ladigan xabarni ajratib
/// oladi — backend (`NestJS`) standart xatolik shakli
/// `{statusCode, message, error}` bo'lib, `message` string YOKI
/// (`class-validator`dan) string ro'yxati bo'lishi mumkin.
String _extractErrorMessage(DioException e) {
  final data = e.response?.data;
  if (data is Map<String, dynamic>) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) {
      return _authErrorTranslations[message] ?? message;
    }
    if (message is List && message.isNotEmpty) {
      return message.map((m) => m.toString()).join('\n');
    }
  }
  return e.message ?? 'Server xatosi';
}

/// JWT (`accessToken`)ning ikkinchi qismini (payload) base64url'dan
/// dekodlaydi va `sub` claim'ini qaytaradi — real backend
/// (`/auth/verify-otp`) foydalanuvchi identifikatorini alohida maydon
/// sifatida QAYTARMAYDI (faqat token juftligi), shuning uchun `userId`
/// tokenning o'zidan olinadi. Har qanday shaklsizlik/xato — jimgina `null`
/// (hech qachon qulamaydi, faqat pastroq darajadagi fallback ishlatiladi).
String? _decodeJwtSubject(String token) {
  try {
    final parts = token.split('.');
    if (parts.length != 3) return null;
    final normalized = base64Url.normalize(parts[1]);
    final payload = jsonDecode(utf8.decode(base64Url.decode(normalized)));
    if (payload is Map<String, dynamic>) {
      final sub = payload['sub'];
      if (sub is String && sub.isNotEmpty) return sub;
    }
  } on Object {
    // Shaklsiz/kutilmagan token — pastroq darajadagi fallback ishlatiladi.
  }
  return null;
}

/// Real backend implementatsiyasi — `DioClient` orqali
/// `https://murojaatnoma.uz/api/auth/*`ga ulanadi.
class AuthApiImpl implements AuthRemoteDataSource {
  AuthApiImpl(this._client);

  final DioClient _client;

  @override
  Future<void> sendOtp(String phone) async {
    try {
      await _client.dio.post<Map<String, dynamic>>(
        '/auth/request-otp',
        data: {'phone': _normalizePhone(phone)},
      );
      // Javob `{expiresInSeconds, devCode?}` — hozircha UI bularni
      // ishlatmaydi (`AuthRepository.sendOtp` faqat `Future<void>`
      // qaytaradi), shuning uchun ataylab e'tiborsiz qoldiriladi.
    } on DioException catch (e) {
      throw ServerException(_extractErrorMessage(e));
    }
  }

  @override
  Future<AuthSessionModel> verifyOtp({
    required String phone,
    required String code,
  }) async {
    try {
      final normalizedPhone = _normalizePhone(phone);
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/auth/verify-otp',
        data: {'phone': normalizedPhone, 'code': code},
      );
      final data = response.data ?? const {};
      final accessToken = data['accessToken'] as String?;
      if (accessToken == null || accessToken.isEmpty) {
        throw AuthException('Server javobida token topilmadi');
      }

      // Real backend `{accessToken, refreshToken, expiresIn}` qaytaradi —
      // fuqaroning ismi/hududi haqida HECH NARSA bermaydi (bular
      // `/register` bosqichida `RegistrationRepository`ga alohida
      // saqlanadi). Shu tufayli `name`/`region` bu yerda faqat vaqtinchalik
      // (placeholder) qiymatlar bilan to'ldiriladi — `userId` esa
      // tokenning o'zidan (`sub` claim) olinadi, topilmasa telefon raqami
      // fallback sifatida ishlatiladi.
      return AuthSessionModel(
        token: accessToken,
        refreshToken: data['refreshToken'] as String?,
        userId: _decodeJwtSubject(accessToken) ?? normalizedPhone,
        name: normalizedPhone,
        phone: normalizedPhone,
        region: '',
      );
    } on DioException catch (e) {
      throw ServerException(_extractErrorMessage(e));
    }
  }
}
