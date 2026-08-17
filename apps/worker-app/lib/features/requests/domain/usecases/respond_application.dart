import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';

/// Murojaatga javob yozish (matn + ixtiyoriy biriktirmalar).
class RespondApplication
    implements UseCase<Application, RespondApplicationParams> {
  RespondApplication(this.repository);

  final ApplicationsRepository repository;

  @override
  Future<Either<Failure, Application>> call(
    RespondApplicationParams params,
  ) {
    return repository.respond(params.id, params.response);
  }
}

/// [RespondApplication] uchun kirish parametrlari.
class RespondApplicationParams extends Equatable {
  const RespondApplicationParams({required this.id, required this.response});

  final String id;
  final ApplicationResponse response;

  @override
  List<Object?> get props => [id, response];
}
