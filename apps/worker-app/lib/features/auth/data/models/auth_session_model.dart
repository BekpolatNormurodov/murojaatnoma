import 'package:worker_app/features/auth/domain/entities/auth_session.dart';

/// AuthSession ma'lumot modeli — JSON (de)serializatsiya bilan.
class AuthSessionModel extends AuthSession {
  const AuthSessionModel({
    required super.token,
    required super.workerId,
    required super.name,
    required super.position,
    required super.region,
    super.refreshToken,
    super.phone,
    super.district,
    super.role,
    super.avatarUrl,
    super.hasFace,
  });

  /// Mahalliy (`SharedPreferences`) saqlangan sessiya JSON'ini o'qiydi —
  /// eski (qo'shimcha maydonlarsiz) yozuvlar ham xavfsiz o'qiladi (barcha
  /// yangi maydonlar ixtiyoriy).
  factory AuthSessionModel.fromJson(Map<String, dynamic> json) {
    return AuthSessionModel(
      token: json['token'] as String,
      workerId: json['worker_id'] as String,
      name: json['name'] as String,
      position: json['position'] as String,
      region: json['region'] as String,
      refreshToken: json['refresh_token'] as String?,
      phone: json['phone'] as String?,
      district: json['district'] as String?,
      role: json['role'] as String?,
      avatarUrl: json['avatar_url'] as String?,
      hasFace: json['has_face'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'token': token,
    'worker_id': workerId,
    'name': name,
    'position': position,
    'region': region,
    if (refreshToken != null) 'refresh_token': refreshToken,
    if (phone != null) 'phone': phone,
    if (district != null) 'district': district,
    if (role != null) 'role': role,
    if (avatarUrl != null) 'avatar_url': avatarUrl,
    'has_face': hasFace,
  };
}
