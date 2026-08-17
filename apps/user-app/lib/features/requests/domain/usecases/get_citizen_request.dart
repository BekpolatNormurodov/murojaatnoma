import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';

/// Bitta murojaatni ID bo'yicha olish.
class GetCitizenRequest
    implements UseCase<CitizenRequest, GetCitizenRequestParams> {
  GetCitizenRequest(this.repository);

  final CitizenRequestsRepository repository;

  @override
  Future<Either<Failure, CitizenRequest>> call(
    GetCitizenRequestParams params,
  ) {
    return repository.getById(params.id);
  }
}

/// [GetCitizenRequest] uchun kirish parametri.
class GetCitizenRequestParams extends Equatable {
  const GetCitizenRequestParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
