import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/features/requests/domain/repositories/citizen_requests_repository.dart';

/// Murojaat mavzusiga fuqaro nomidan yangi xabar yozish.
class SendRequestMessage
    implements UseCase<RequestMessage, SendRequestMessageParams> {
  SendRequestMessage(this.repository);

  final CitizenRequestsRepository repository;

  @override
  Future<Either<Failure, RequestMessage>> call(
    SendRequestMessageParams params,
  ) {
    return repository.sendMessage(params.id, params.text);
  }
}

/// [SendRequestMessage] uchun kirish parametri.
class SendRequestMessageParams extends Equatable {
  const SendRequestMessageParams({required this.id, required this.text});

  final String id;
  final String text;

  @override
  List<Object?> get props => [id, text];
}
