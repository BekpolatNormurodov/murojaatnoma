import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';

/// Yangi ariza/shikoyat yuborish.
///
/// Kirish parametri sifatida to'g'ridan-to'g'ri [CitizenRequest] (draft)
/// ishlatiladi — alohida `Params` klass shart emas, chunki
/// [CitizenRequestsRepository.submit] bitta argument oladi.
class SubmitCitizenRequest implements UseCase<CitizenRequest, CitizenRequest> {
  SubmitCitizenRequest(this.repository);

  final CitizenRequestsRepository repository;

  @override
  Future<Either<Failure, CitizenRequest>> call(CitizenRequest draft) {
    return repository.submit(draft);
  }
}
