import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';

/// Xabarlar (chat) moduli bilan ishlash uchun shartnoma — suhbatlar
/// ro'yxatini (filtrlash bilan) o'qish, bitta suhbat xabarlarini olish
/// va yangi xabar yuborish.
abstract class ChatRepository {
  /// Suhbatlar ro'yxatini oladi.
  ///
  /// [type] — berilsa, faqat shu turdagi suhbatlar bilan filtrlaydi.
  /// [query] — sarlavha bo'yicha erkin qidiruv matni.
  Future<Either<Failure, List<Conversation>>> conversations({
    ConversationType? type,
    String? query,
  });

  /// Bitta suhbatning xabarlar tarixini oladi.
  Future<Either<Failure, List<Message>>> messages(String conversationId);

  /// Suhbatga yangi xabar (matn/media/stiker) yuboradi.
  Future<Either<Failure, Message>> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  });
}
