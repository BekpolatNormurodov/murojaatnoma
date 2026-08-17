import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/repositories/chat_repository.dart';

/// Bitta suhbatning xabarlar tarixini olish.
class GetMessages implements UseCase<List<Message>, GetMessagesParams> {
  GetMessages(this.repository);

  final ChatRepository repository;

  @override
  Future<Either<Failure, List<Message>>> call(GetMessagesParams params) {
    return repository.messages(params.conversationId);
  }
}

/// [GetMessages] uchun kirish parametri.
class GetMessagesParams extends Equatable {
  const GetMessagesParams(this.conversationId);

  final String conversationId;

  @override
  List<Object?> get props => [conversationId];
}
