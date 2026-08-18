import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';

/// Xodim login+parol bilan kirish UseCase'i.
///
/// Fuqarolar (user-app) faqat SMS/OTP orqali kiradi; xodimlar (worker-app)
/// esa login+parol orqali (`POST /auth/employee/login`). Muvaffaqiyatli
/// bo'lsa sessiya (`AuthSession`) qaytariladi va token saqlanadi.
class LoginEmployee implements UseCase<AuthSession, LoginEmployeeParams> {
  LoginEmployee(this.repository);

  final AuthRepository repository;

  @override
  Future<Either<Failure, AuthSession>> call(LoginEmployeeParams params) {
    return repository.login(
      username: params.username,
      password: params.password,
    );
  }
}

class LoginEmployeeParams extends Equatable {
  const LoginEmployeeParams({required this.username, required this.password});

  final String username;
  final String password;

  @override
  List<Object?> get props => [username, password];
}
