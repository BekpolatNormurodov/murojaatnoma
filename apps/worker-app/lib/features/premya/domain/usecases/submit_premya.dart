import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/premya/domain/entities/bonus_request.dart';
import 'package:worker_app/features/premya/domain/repositories/premya_repository.dart';

/// Yangi premya ("mukofot so'rash") so'rovi yuborish.
class SubmitPremya implements UseCase<BonusRequest, SubmitPremyaParams> {
  SubmitPremya(this.repository);

  final PremyaRepository repository;

  @override
  Future<Either<Failure, BonusRequest>> call(SubmitPremyaParams params) {
    return repository.submit(reason: params.reason, amount: params.amount);
  }
}

/// [SubmitPremya] uchun kirish parametrlari.
class SubmitPremyaParams extends Equatable {
  const SubmitPremyaParams({required this.reason, this.amount});

  /// So'ralayotgan mukofot summasi (so'mda) — ixtiyoriy.
  final int? amount;
  final String reason;

  @override
  List<Object?> get props => [amount, reason];
}
