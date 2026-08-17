import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';

/// Telefonga yuborilgan SMS-OTP kodni tasdiqlash.
class VerifyOtp implements UseCase<AuthSession, VerifyOtpParams> {
  VerifyOtp(this.repository);

  final AuthRepository repository;

  @override
  Future<Either<Failure, AuthSession>> call(VerifyOtpParams params) {
    return repository.verifyOtp(phone: params.phone, code: params.code);
  }
}

class VerifyOtpParams extends Equatable {
  const VerifyOtpParams({required this.phone, required this.code});

  final String phone;
  final String code;

  @override
  List<Object?> get props => [phone, code];
}
