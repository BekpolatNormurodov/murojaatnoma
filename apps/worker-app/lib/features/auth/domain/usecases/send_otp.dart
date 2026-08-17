import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';

/// Telefon raqamiga SMS-OTP tasdiqlash kodini yuborish.
///
/// Muvaffaqiyat qiymati — server qaytargan `devCode` (bo'lsa). Faqat
/// backend `OTP_DEV_ECHO=true` bo'lganda (dev/staging) keladi, shu orqali
/// real SMS gateway'siz login test qilinadi; production'da doim `null`.
class SendOtp implements UseCase<String?, SendOtpParams> {
  SendOtp(this.repository);

  final AuthRepository repository;

  @override
  Future<Either<Failure, String?>> call(SendOtpParams params) {
    return repository.sendOtp(params.phone);
  }
}

class SendOtpParams extends Equatable {
  const SendOtpParams(this.phone);

  final String phone;

  @override
  List<Object?> get props => [phone];
}
