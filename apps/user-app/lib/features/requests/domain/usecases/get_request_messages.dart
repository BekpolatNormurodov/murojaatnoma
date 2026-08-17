import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';

/// Bitta murojaat mavzusidagi barcha xabarlarni (thread) olish.
class GetRequestMessages
    implements UseCase<List<RequestMessage>, GetRequestMessagesParams> {
  GetRequestMessages(this.repository);

  final CitizenRequestsRepository repository;

  @override
  Future<Either<Failure, List<RequestMessage>>> call(
    GetRequestMessagesParams params,
  ) {
    return repository.getMessages(params.id);
  }
}

/// [GetRequestMessages] uchun kirish parametri.
class GetRequestMessagesParams extends Equatable {
  const GetRequestMessagesParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
