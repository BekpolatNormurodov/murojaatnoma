import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';

/// Bitta murojaatni ID bo'yicha olish.
class GetApplication implements UseCase<Application, GetApplicationParams> {
  GetApplication(this.repository);

  final ApplicationsRepository repository;

  @override
  Future<Either<Failure, Application>> call(GetApplicationParams params) {
    return repository.getById(params.id);
  }
}

/// [GetApplication] uchun kirish parametri.
class GetApplicationParams extends Equatable {
  const GetApplicationParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
