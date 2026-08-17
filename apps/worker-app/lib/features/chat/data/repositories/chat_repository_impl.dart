// DI: register in injection.dart
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/chat/data/datasources/chat_remote_data_source.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/repositories/chat_repository.dart';

/// `ChatRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class ChatRepositoryImpl implements ChatRepository {
  ChatRepositoryImpl({required this.remote});

  final ChatRemoteDataSource remote;

  @override
  Future<Either<Failure, List<Conversation>>> conversations({
    ConversationType? type,
    String? query,
  }) async {
    try {
      final result = await remote.conversations(type: type, query: query);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, List<Message>>> messages(String conversationId) async {
    try {
      final result = await remote.messages(conversationId);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Message>> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    try {
      final result = await remote.sendMessage(
        conversationId: conversationId,
        type: type,
        text: text,
        attachment: attachment,
        stickerId: stickerId,
      );
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
