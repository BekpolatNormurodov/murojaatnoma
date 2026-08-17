import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';

/// Murojaatlar ro'yxatini (ixtiyoriy filtrlar bilan) olish.
class GetApplications
    implements UseCase<List<Application>, GetApplicationsParams> {
  GetApplications(this.repository);

  final ApplicationsRepository repository;

  @override
  Future<Either<Failure, List<Application>>> call(
    GetApplicationsParams params,
  ) {
    return repository.list(
      assignedOnly: params.assignedOnly,
      status: params.status,
      query: params.query,
    );
  }
}

/// [GetApplications] uchun filtr parametrlari.
class GetApplicationsParams extends Equatable {
  const GetApplicationsParams({
    this.assignedOnly = false,
    this.status,
    this.query,
  });

  final bool assignedOnly;
  final ApplicationStatus? status;
  final String? query;

  @override
  List<Object?> get props => [assignedOnly, status, query];
}
