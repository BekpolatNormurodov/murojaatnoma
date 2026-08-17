import 'package:worker_app/features/auth/domain/entities/auth_session.dart';

/// AuthSession ma'lumot modeli — JSON (de)serializatsiya bilan.
class AuthSessionModel extends AuthSession {
  const AuthSessionModel({
    required super.token,
    required super.workerId,
    required super.name,
    required super.position,
    required super.region,
  });

  factory AuthSessionModel.fromJson(Map<String, dynamic> json) {
    return AuthSessionModel(
      token: json['token'] as String,
      workerId: json['worker_id'] as String,
      name: json['name'] as String,
      position: json['position'] as String,
      region: json['region'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'token': token,
    'worker_id': workerId,
    'name': name,
    'position': position,
    'region': region,
  };
}
