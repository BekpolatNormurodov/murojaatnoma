import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';

/// Murojaatga ball (baho) qo'yish.
class RateApplication implements UseCase<Application, RateApplicationParams> {
  RateApplication(this.repository);

  final ApplicationsRepository repository;

  @override
  Future<Either<Failure, Application>> call(RateApplicationParams params) {
    return repository.rate(params.id, params.points);
  }
}

/// [RateApplication] uchun kirish parametrlari.
class RateApplicationParams extends Equatable {
  const RateApplicationParams({required this.id, required this.points});

  final String id;
  final int points;

  @override
  List<Object?> get props => [id, points];
}
