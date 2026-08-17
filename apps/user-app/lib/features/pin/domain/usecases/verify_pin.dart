import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/pin/domain/repositories/pin_repository.dart';

/// Kiritilgan PIN kodni saqlangan xesh bilan solishtirib tekshirish.
class VerifyPin implements UseCase<bool, VerifyPinParams> {
  VerifyPin(this.repository);

  final PinRepository repository;

  @override
  Future<Either<Failure, bool>> call(VerifyPinParams params) {
    return repository.verifyPin(params.pin);
  }
}

class VerifyPinParams extends Equatable {
  const VerifyPinParams(this.pin);

  final String pin;

  @override
  List<Object?> get props => [pin];
}
