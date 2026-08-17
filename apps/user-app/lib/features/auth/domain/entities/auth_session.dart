import 'package:equatable/equatable.dart';

/// Fuqaroning avtorizatsiya sessiyasi.
class AuthSession extends Equatable {
  const AuthSession({
    required this.token,
    required this.userId,
    required this.name,
    required this.phone,
    required this.region,
  });

  final String token;
  final String userId;
  final String name;
  final String phone;
  final String region;

  @override
  List<Object?> get props => [token, userId, name, phone, region];
}
