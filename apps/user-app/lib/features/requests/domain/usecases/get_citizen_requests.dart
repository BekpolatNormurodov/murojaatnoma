import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';

/// Fuqaro murojaatlari ro'yxatini (ixtiyoriy filtrlar bilan) olish.
class GetCitizenRequests
    implements UseCase<List<CitizenRequest>, GetCitizenRequestsParams> {
  GetCitizenRequests(this.repository);

  final CitizenRequestsRepository repository;

  @override
  Future<Either<Failure, List<CitizenRequest>>> call(
    GetCitizenRequestsParams params,
  ) {
    return repository.list(
      kind: params.kind,
      status: params.status,
      query: params.query,
    );
  }
}

/// [GetCitizenRequests] uchun filtr parametrlari.
class GetCitizenRequestsParams extends Equatable {
  const GetCitizenRequestsParams({this.kind, this.status, this.query});

  final RequestKind? kind;
  final RequestStatus? status;
  final String? query;

  @override
  List<Object?> get props => [kind, status, query];
}
