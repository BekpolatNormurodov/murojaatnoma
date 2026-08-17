import 'package:user_app/features/auth/domain/entities/auth_session.dart';

/// AuthSession ma'lumot modeli — JSON (de)serializatsiya bilan.
class AuthSessionModel extends AuthSession {
  const AuthSessionModel({
    required super.token,
    required super.userId,
    required super.name,
    required super.phone,
    required super.region,
    this.refreshToken,
  });

  /// **Diqqat**: bu yerdagi shakl (`token`/`user_id`/...) — REAL backend
  /// javobining aksi EMAS (`/auth/verify-otp` `{accessToken, refreshToken,
  /// expiresIn}` qaytaradi, foydalanuvchi nomi/hududi haqida umuman
  /// ma'lumot bermaydi) — bu faqat `AuthRepositoryImpl`ning o'zi
  /// `toJson()` orqali xavfsiz xotiraga yozgan sessiyani QAYTA O'QISH
  /// (round-trip) uchun ishlatiladi. Real backend javobini
  /// `AuthSessionModel`ga aylantirish `AuthApiImpl.verifyOtp`da qo'lda
  /// (konstruktor orqali) amalga oshiriladi.
  factory AuthSessionModel.fromJson(Map<String, dynamic> json) {
    return AuthSessionModel(
      token: json['token'] as String,
      userId: json['user_id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      region: json['region'] as String,
      refreshToken: json['refresh_token'] as String?,
    );
  }

  /// `/auth/refresh` uchun — hozircha hech qanday oqim uni ISTE'MOL
  /// qilmaydi (kelajakdagi avtomatik-yangilash uchun saqlanadi), lekin
  /// `AuthRepositoryImpl` uni alohida `SharedPreferences` kalitida
  /// saqlaydi.
  final String? refreshToken;

  Map<String, dynamic> toJson() => {
    'token': token,
    'user_id': userId,
    'name': name,
    'phone': phone,
    'region': region,
    'refresh_token': refreshToken,
  };
}
