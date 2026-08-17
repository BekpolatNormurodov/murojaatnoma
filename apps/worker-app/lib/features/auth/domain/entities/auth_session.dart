import 'package:equatable/equatable.dart';

/// Ishchining avtorizatsiya sessiyasi.
class AuthSession extends Equatable {
  const AuthSession({
    required this.token,
    required this.workerId,
    required this.name,
    required this.position,
    required this.region,
  });

  final String token;
  final String workerId;
  final String name;
  final String position;
  final String region;

  @override
  List<Object?> get props => [token, workerId, name, position, region];
}
