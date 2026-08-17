import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/repositories/chat_repository.dart';

/// Suhbatlar ro'yxatini (ixtiyoriy tur filtri/qidiruv bilan) olish.
class GetConversations
    implements UseCase<List<Conversation>, GetConversationsParams> {
  GetConversations(this.repository);

  final ChatRepository repository;

  @override
  Future<Either<Failure, List<Conversation>>> call(
    GetConversationsParams params,
  ) {
    return repository.conversations(type: params.type, query: params.query);
  }
}

/// [GetConversations] uchun filtr parametrlari.
class GetConversationsParams extends Equatable {
  const GetConversationsParams({this.type, this.query});

  final ConversationType? type;
  final String? query;

  @override
  List<Object?> get props => [type, query];
}
