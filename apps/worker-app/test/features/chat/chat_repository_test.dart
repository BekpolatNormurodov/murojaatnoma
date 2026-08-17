import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/chat/data/datasources/chat_remote_data_source.dart';
import 'package:worker_app/features/chat/data/repositories/chat_repository_impl.dart';
import 'package:worker_app/features/chat/domain/entities/conversation.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';

/// Xotirada ishlaydigan soxta (fake) masofaviy manba. `*Error` maydonlari
/// orqali datasource (tarmoq/server) xatoliklarini simulyatsiya
/// qiladi — `applications_repository_test.dart`dagi
/// `_FakeApplicationsRemoteDataSource`ning uslubiga o'xshash.
class _FakeChatRemoteDataSource implements ChatRemoteDataSource {
  List<Conversation>? conversationsResult;
  List<Message>? messagesResult;
  Message? sendMessageResult;
  Exception? conversationsError;
  Exception? messagesError;
  Exception? sendMessageError;

  @override
  Future<List<Conversation>> conversations({
    ConversationType? type,
    String? query,
  }) async {
    final err = conversationsError;
    if (err != null) throw err;
    return conversationsResult!;
  }

  @override
  Future<List<Message>> messages(String conversationId) async {
    final err = messagesError;
    if (err != null) throw err;
    return messagesResult!;
  }

  @override
  Future<Message> sendMessage({
    required String conversationId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    final err = sendMessageError;
    if (err != null) throw err;
    return sendMessageResult!;
  }
}

void main() {
  group(ChatRepositoryImpl, () {
    late _FakeChatRemoteDataSource remote;
    late ChatRepositoryImpl subject;

    const conversation = Conversation(
      id: 'CHT-9001',
      type: ConversationType.shaxsiy,
      title: 'Sinov suhbati',
      participants: 2,
      lastMessageAt: '2026-07-24T08:00:00',
      unreadCount: 0,
    );

    const message = Message(
      id: 'MSG-9001',
      conversationId: 'CHT-9001',
      senderId: 'me',
      senderName: 'Siz',
      isMine: true,
      type: MessageType.text,
      text: 'Salom',
      createdAt: '2026-07-24T08:00:00',
      status: MessageStatus.yuborildi,
    );

    setUp(() {
      remote = _FakeChatRemoteDataSource();
      subject = ChatRepositoryImpl(remote: remote);
    });

    group('conversations', () {
      test('datasource success -> Right(List<Conversation>)', () async {
        remote.conversationsResult = [conversation];

        final result = await subject.conversations();

        result.fold(
          (l) => fail('expected Right(List<Conversation>), got Left: $l'),
          (r) => expect(r, [conversation]),
        );
      });

      test('datasource throws ServerException -> Left(ServerFailure) '
          'carrying its message', () async {
        remote.conversationsError = ServerException('backend nosoz ishladi');

        final result = await subject.conversations();

        result.fold((l) {
          expect(l, isA<ServerFailure>());
          expect(l.message, 'backend nosoz ishladi');
        }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
      });

      test('datasource throws a generic Exception -> Left(ServerFailure) '
          'via the fallback branch (never escapes uncaught)', () async {
        remote.conversationsError = Exception('kutilmagan xato');

        final result = await subject.conversations();

        result.fold(
          (l) => expect(l, isA<ServerFailure>()),
          (r) => fail('expected Left(ServerFailure), got Right: $r'),
        );
      });
    });

    group('messages', () {
      test('datasource success -> Right(List<Message>)', () async {
        remote.messagesResult = [message];

        final result = await subject.messages(conversation.id);

        result.fold(
          (l) => fail('expected Right(List<Message>), got Left: $l'),
          (r) => expect(r, [message]),
        );
      });

      test('datasource throws ServerException -> Left(ServerFailure) '
          'carrying its message', () async {
        remote.messagesError = ServerException('suhbat topilmadi');

        final result = await subject.messages(conversation.id);

        result.fold((l) {
          expect(l, isA<ServerFailure>());
          expect(l.message, 'suhbat topilmadi');
        }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
      });

      test('datasource throws a generic Exception -> Left(ServerFailure) '
          'via the fallback branch (never escapes uncaught)', () async {
        remote.messagesError = Exception('kutilmagan xato');

        final result = await subject.messages(conversation.id);

        result.fold(
          (l) => expect(l, isA<ServerFailure>()),
          (r) => fail('expected Left(ServerFailure), got Right: $r'),
        );
      });
    });

    group('sendMessage', () {
      test('datasource success -> Right(Message)', () async {
        remote.sendMessageResult = message;

        final result = await subject.sendMessage(
          conversationId: conversation.id,
          type: MessageType.text,
          text: 'Salom',
        );

        result.fold(
          (l) => fail('expected Right(Message), got Left: $l'),
          (r) => expect(r, message),
        );
      });

      test('datasource throws ServerException -> Left(ServerFailure) '
          'carrying its message', () async {
        remote.sendMessageError = ServerException('xabar yuborilmadi');

        final result = await subject.sendMessage(
          conversationId: conversation.id,
          type: MessageType.text,
          text: 'Salom',
        );

        result.fold((l) {
          expect(l, isA<ServerFailure>());
          expect(l.message, 'xabar yuborilmadi');
        }, (r) => fail('expected Left(ServerFailure), got Right: $r'));
      });

      test('datasource throws a generic Exception -> Left(ServerFailure) '
          'via the fallback branch (never escapes uncaught)', () async {
        remote.sendMessageError = Exception('kutilmagan xato');

        final result = await subject.sendMessage(
          conversationId: conversation.id,
          type: MessageType.text,
          text: 'Salom',
        );

        result.fold(
          (l) => expect(l, isA<ServerFailure>()),
          (r) => fail('expected Left(ServerFailure), got Right: $r'),
        );
      });
    });
  });

  group('Message JSON', () {
    test('fromJson(toJson(x)) round-trips through real JSON encode/decode, '
        'preserving int-typed fields (duration_ms/size_bytes)', () {
      const original = Message(
        id: 'MSG-9002',
        conversationId: 'CHT-9002',
        senderId: 'USR-1',
        senderName: 'Test Foydalanuvchi',
        isMine: false,
        type: MessageType.voice,
        attachment: ChatAttachment(
          kind: MessageType.voice,
          path: '/tmp/a.m4a',
          name: 'a.m4a',
          durationMs: 5000,
          sizeBytes: 2048,
        ),
        createdAt: '2026-07-24T10:00:00',
        status: MessageStatus.yetkazildi,
      );

      // Haqiqiy JSON kodlash/dekodlashdan o'tkazib, sonlar `int` sifatida
      // qaytishini ta'minlaydi (`dart:convert` butun sonlarni `int`
      // qilib dekodlaydi) — `(x as num).toInt()` xavfsizligini sinaydi.
      final jsonString = jsonEncode(original.toJson());
      final decodedMap = jsonDecode(jsonString) as Map<String, dynamic>;
      final rebuilt = Message.fromJson(decodedMap);

      expect(rebuilt, original);
      final attachmentJson = decodedMap['attachment'] as Map<String, dynamic>;
      expect(attachmentJson['duration_ms'], isA<int>());
      expect(rebuilt.attachment?.durationMs, 5000);
      expect(rebuilt.attachment?.sizeBytes, 2048);
    });

    test('fromJson handles null-safe optional fields', () {
      final json = <String, dynamic>{
        'id': 'MSG-9003',
        'conversation_id': 'CHT-9003',
        'sender_id': 'me',
        'sender_name': 'Siz',
        'is_mine': true,
        'type': 'text',
        'text': 'Salom',
        'attachment': null,
        'sticker_id': null,
        'created_at': '2026-07-24T11:00:00',
        'status': 'yuborilmoqda',
      };

      final message = Message.fromJson(json);

      expect(message.attachment, isNull);
      expect(message.stickerId, isNull);
      expect(message.text, 'Salom');
      expect(message.status, MessageStatus.yuborilmoqda);
    });
  });
}
