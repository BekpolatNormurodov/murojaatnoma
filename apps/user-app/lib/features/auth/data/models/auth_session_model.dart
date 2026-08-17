import 'package:user_app/features/auth/domain/entities/auth_session.dart';

/// AuthSession ma'lumot modeli — JSON (de)serializatsiya bilan.
class AuthSessionModel extends AuthSession {
  const AuthSessionModel({
    required super.token,
    required super.userId,
    required super.name,
    required super.phone,
    required super.region,
  });

  factory AuthSessionModel.fromJson(Map<String, dynamic> json) {
    return AuthSessionModel(
      token: json['token'] as String,
      userId: json['user_id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String,
      region: json['region'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'token': token,
    'user_id': userId,
    'name': name,
    'phone': phone,
    'region': region,
  };
}
