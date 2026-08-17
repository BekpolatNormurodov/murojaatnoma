import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:worker_app/core/mock/mock_chat.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';

/// Xabarlar (chat) moduli uchun masofaviy ma'lumot manbai.
abstract class ChatRemoteDataSource {
  Future<List<Conversation>> conversations({
    ConversationType? type,
    String? query,
  });

  Future<List<Message>> messages(String conversationId);

  Future<Message> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  });
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_chat.dart`dagi xotiradagi
/// ro'yxatlar bilan ishlaydi.
class ChatRemoteDataSourceMockImpl implements ChatRemoteDataSource {
  @override
  Future<List<Conversation>> conversations({
    ConversationType? type,
    String? query,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));

    var result = List<Conversation>.of(mockConversations);
    if (type != null) {
      result = result.where((c) => c.type == type).toList();
    }
    final normalizedQuery = query?.trim().toLowerCase();
    if (normalizedQuery != null && normalizedQuery.isNotEmpty) {
      result = result
          .where((c) => c.title.toLowerCase().contains(normalizedQuery))
          .toList();
    }
    return List.unmodifiable(result);
  }

  @override
  Future<List<Message>> messages(String conversationId) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final exists = mockConversations.any((c) => c.id == conversationId);
    if (!exists) throw ServerException('Suhbat topilmadi: $conversationId');

    return List.unmodifiable(
      mockMessages.where((m) => m.conversationId == conversationId),
    );
  }

  @override
  Future<Message> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final index = mockConversations.indexWhere((c) => c.id == conversationId);
    if (index == -1) {
      throw ServerException('Suhbat topilmadi: $conversationId');
    }

    final now = DateTime.now().toIso8601String();
    final message = Message(
      id: 'MSG-${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: 'me',
      senderName: 'Siz',
      isMine: true,
      type: type,
      text: text,
      attachment: attachment,
      stickerId: stickerId,
      createdAt: now,
      status: MessageStatus.yuborildi,
    );
    mockMessages.add(message);
    mockConversations[index] = _withUpdate(
      mockConversations[index],
      lastMessagePreview: _previewFor(type: type, text: text),
      lastMessageAt: now,
    );

    return message;
  }
}

/// Xabar turiga qarab ro'yxatda ko'rsatiladigan qisqa "oxirgi xabar"
/// matnini hosil qiladi.
String _previewFor({required MessageType type, String? text}) {
  return switch (type) {
    MessageType.text => text ?? '',
    MessageType.image => 'Rasm',
    MessageType.file => 'Fayl',
    MessageType.voice => 'Ovozli xabar',
    MessageType.roundVideo => 'Video xabar',
    MessageType.sticker => 'Stiker',
  };
}

/// Mavjud [Conversation]dan ba'zi maydonlarini almashtirib, yangisini
/// yaratadi. `sendMessage` mock mutatsiyasi uchun ichki yordamchi —
/// domen entitisi (`Conversation`) o'zida ochiq `copyWith` olib
/// yurmasligi uchun shu yerda (data qatlamida) xususiy saqlangan.
Conversation _withUpdate(
  Conversation source, {
  String? lastMessagePreview,
  String? lastMessageAt,
}) {
  return Conversation(
    id: source.id,
    type: source.type,
    title: source.title,
    avatarUrl: source.avatarUrl,
    participants: source.participants,
    lastMessagePreview: lastMessagePreview ?? source.lastMessagePreview,
    lastMessageAt: lastMessageAt ?? source.lastMessageAt,
    unreadCount: source.unreadCount,
  );
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class ChatRemoteDataSourceApiImpl implements ChatRemoteDataSource {
  ChatRemoteDataSourceApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Conversation>> conversations({
    ConversationType? type,
    String? query,
  }) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/chats',
        queryParameters: {
          if (type != null) 'type': type.name,
          if (query != null && query.isNotEmpty) 'query': query,
        },
      );
      final data = response.data ?? const [];
      return data
          .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<List<Message>> messages(String conversationId) async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/chats/$conversationId/messages',
      );
      final data = response.data ?? const [];
      return data
          .map((e) => Message.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Message> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    try {
      final result = await _client.dio.post<Map<String, dynamic>>(
        '/chats/$conversationId/messages',
        data: {
          'type': type.name,
          'text': text,
          'attachment': attachment?.toJson(),
          'sticker_id': stickerId,
        },
      );
      return Message.fromJson(result.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
