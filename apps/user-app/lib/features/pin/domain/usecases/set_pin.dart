import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/pin/domain/repositories/pin_repository.dart';

/// Yangi PIN kodni (xeshlab) o'rnatish.
class SetPin implements UseCase<Unit, SetPinParams> {
  SetPin(this.repository);

  final PinRepository repository;

  @override
  Future<Either<Failure, Unit>> call(SetPinParams params) {
    return repository.setPin(params.pin);
  }
}

class SetPinParams extends Equatable {
  const SetPinParams(this.pin);

  final String pin;

  @override
  List<Object?> get props => [pin];
}
