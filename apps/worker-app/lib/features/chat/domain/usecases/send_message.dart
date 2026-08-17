import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/repositories/chat_repository.dart';

/// Suhbatga yangi xabar (matn/media/stiker) yuborish.
class SendMessage implements UseCase<Message, SendMessageParams> {
  SendMessage(this.repository);

  final ChatRepository repository;

  @override
  Future<Either<Failure, Message>> call(SendMessageParams params) {
    return repository.sendMessage(
      conversationId: params.conversationId,
      type: params.type,
      text: params.text,
      attachment: params.attachment,
      stickerId: params.stickerId,
    );
  }
}

/// [SendMessage] uchun kirish parametrlari.
class SendMessageParams extends Equatable {
  const SendMessageParams({
    required this.conversationId,
    required this.type,
    this.text,
    this.attachment,
    this.stickerId,
  });

  final String conversationId;
  final MessageType type;
  final String? text;
  final ChatAttachment? attachment;
  final String? stickerId;

  @override
  List<Object?> get props => [
    conversationId,
    type,
    text,
    attachment,
    stickerId,
  ];
}
