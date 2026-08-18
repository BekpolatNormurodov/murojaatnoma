import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/core/realtime/realtime_socket_service.dart';
import 'package:worker_app/core/realtime/uploads_service.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/usecases/get_messages.dart';
import 'package:worker_app/features/chat/domain/usecases/send_message.dart';
import 'package:worker_app/features/chat/presentation/widgets/sticker_catalog.dart';

part 'conversation_state.dart';

/// Bitta suhbat sahifasini boshqaruvchi Cubit — xabarlar tarixini
/// yuklaydi va yangi xabar (matn/media/stiker) yuboradi.
///
/// **Jonli (realtime) rejim** ([RealtimeSocketService] ulangan VA
/// `AppConfig.useMock == false` bo'lganda):
///  - [open] suhbat xonasiga qo'shiladi (`chat:join`) va `chat:message` /
///    `chat:message:deleted` / `chat:message:edited` / `chat:typing`
///    oqimlariga obuna bo'ladi; kelgan xabarlar joriy ro'yxatga (optimistik
///    almashtirish/qo'shish yo'li orqali) qo'shiladi.
///  - [send] media biriktirmani AVVAL [UploadsService] orqali serverga
///    yuklaydi (mahalliy fayl -> URL), so'ng `chat:send` emit qiladi —
///    eski (o'lik) `/applications/:id/messages` POST o'rniga.
///
/// **Mock/oflayn rejim** (socket ulanmagan yoki `AppConfig.useMock`):
/// eski oqim to'liq saqlanadi — [send] `SendMessage` usecase'ini chaqiradi,
/// hech qanday socket ishlatilmaydi.
///
/// Hech qachon uncaught tashlamaydi — [open] muvaffaqiyatsizligi
/// [ConversationError] holatiga aylanadi; [send] muvaffaqiyatsizligi esa
/// joriy [ConversationLoaded]ni saqlab qolgan holda xatolik matnini
/// qaytaradi (`Future<String?>` — `null` bo'lsa muvaffaqiyatli).
class ConversationCubit extends Cubit<ConversationState> {
  ConversationCubit({
    required GetMessages getMessages,
    required SendMessage sendMessage,
    required RealtimeSocketService socket,
    required UploadsService uploads,
    required AuthCubit authCubit,
  }) : _getMessages = getMessages,
       _sendMessage = sendMessage,
       _socket = socket,
       _uploads = uploads,
       _authCubit = authCubit,
       super(const ConversationLoading());

  final GetMessages _getMessages;
  final SendMessage _sendMessage;
  final RealtimeSocketService _socket;
  final UploadsService _uploads;
  final AuthCubit _authCubit;

  /// So'nggi [open] bilan chaqirilgan suhbat ID — [retry]/[send] shu ID'ni
  /// ishlatadi.
  String? _conversationId;
  int _localIdSeq = 0;

  /// Serverdan o'z aks-sadosini (echo) kutayotgan optimistik lokal
  /// xabarlar ID'lari (FIFO). Kelgan "mening" xabarim shu navbatdagi
  /// birinchisining o'rnini egallaydi (dublikatlanmasligi uchun).
  final List<String> _pendingLocalIds = [];

  /// Jonli socket oqimlariga obunalar — [open]da o'rnatiladi, [_teardownSocket]
  /// da bekor qilinadi.
  final List<StreamSubscription<Map<String, dynamic>>> _subs = [];

  /// Jonli rejim faolmi (socket ulangan va mock emas).
  bool get _useSocket => !AppConfig.useMock && _socket.isConnected;

  /// Joriy (login qilingan) xodim identifikatori — kelgan xabarlarda
  /// `senderId` shunga teng bo'lsa "mening xabarim" (isMine).
  String? get _myId => _authCubit.state.session?.workerId;

  Future<void> open(String conversationId) async {
    _teardownSocket();
    _conversationId = conversationId;
    _pendingLocalIds.clear();
    emit(const ConversationLoading());
    try {
      final result = await _getMessages(GetMessagesParams(conversationId));
      result.fold((failure) => emit(ConversationError(failure.message)), (
        messages,
      ) {
        emit(ConversationLoaded(_sorted(messages)));
        _attachSocket(conversationId);
      });
    } on Object catch (e) {
      emit(ConversationError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ochilgan suhbatni qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _conversationId;
    return id == null ? Future<void>.value() : open(id);
  }

  /// Yangi xabar (matn/media/stiker) yuboradi — optimistik UI yangilanishi
  /// bilan (yuqoridagi klass hujjatiga qarang).
  ///
  /// Qaytadi: `null` — muvaffaqiyatli; aks holda — ko'rsatiladigan
  /// xatolik matni.
  Future<String?> send({
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    final conversationId = _conversationId;
    final current = state;
    if (conversationId == null || current is! ConversationLoaded) {
      return 'Suhbat hali yuklanmagan';
    }

    final localId = 'LOCAL-${_localIdSeq++}';
    final optimistic = Message(
      id: localId,
      conversationId: conversationId,
      senderId: _myId ?? 'me',
      senderName: 'Siz',
      isMine: true,
      type: type,
      text: text,
      attachment: attachment,
      stickerId: stickerId,
      createdAt: DateTime.now().toIso8601String(),
      status: MessageStatus.yuborilmoqda,
    );
    emit(current.copyWith(messages: [...current.messages, optimistic]));

    // Mock/oflayn: eski usecase yo'li (o'zgarishsiz saqlanadi).
    if (!_useSocket) {
      return _sendViaUsecase(
        conversationId: conversationId,
        localId: localId,
        type: type,
        text: text,
        attachment: attachment,
        stickerId: stickerId,
      );
    }

    // Jonli: media -> URL yuklab, so'ng `chat:send`.
    return _sendViaSocket(
      conversationId: conversationId,
      localId: localId,
      type: type,
      text: text,
      attachment: attachment,
      stickerId: stickerId,
    );
  }

  /// Suhbatdoshga "yozmoqda" signalini yuboradi (`chat:typing`) — faqat
  /// jonli rejimda. Yozish panelidagi matn bo'sh↔to'la o'zgarganda
  /// chaqiriladi.
  void notifyTyping({required bool isTyping}) {
    final id = _conversationId;
    if (id == null || !_useSocket) return;
    _socket.emitTyping(id, isTyping: isTyping);
  }

  // ---- Jonli socket wiring ----

  /// Suhbat xonasiga qo'shiladi, o'qilgan deb belgilaydi va chat
  /// oqimlariga obuna bo'ladi. Faqat jonli rejimda ish bajaradi.
  void _attachSocket(String conversationId) {
    if (!_useSocket) return;

    _socket
      ..joinConversation(conversationId)
      ..markRead(conversationId);

    _subs
      ..add(_socket.chatMessage.listen(_onInboundMessage))
      ..add(_socket.chatMessageEdited.listen(_onInboundMessage))
      ..add(_socket.chatMessageDeleted.listen(_onMessageDeleted))
      ..add(_socket.chatTyping.listen(_onTyping));
  }

  /// Obunalarni bekor qiladi va (agar ochiq bo'lsa) suhbat xonasini
  /// tark etadi — [open] qayta chaqirilganda yoki [close]da.
  void _teardownSocket() {
    for (final sub in _subs) {
      unawaited(sub.cancel());
    }
    _subs.clear();
    final id = _conversationId;
    if (id != null && _useSocket) _socket.leaveConversation(id);
  }

  /// `chat:message` va `chat:message:edited` — `{ conversationId, message }`.
  void _onInboundMessage(Map<String, dynamic> event) {
    if (event['conversationId'] != _conversationId) return;
    final raw = event['message'];
    if (raw is! Map) return;
    _mergeInbound(_messageFromContract(Map<String, dynamic>.from(raw)));
  }

  /// `chat:message:deleted` — `{ conversationId, messageId }`.
  void _onMessageDeleted(Map<String, dynamic> event) {
    if (event['conversationId'] != _conversationId) return;
    final messageId = event['messageId'] as String?;
    final current = state;
    if (messageId == null || current is! ConversationLoaded) return;
    emit(
      current.copyWith(
        messages: current.messages.where((m) => m.id != messageId).toList(),
      ),
    );
  }

  /// `chat:typing` — `{ conversationId, userId, isTyping }`. O'z
  /// signalimizni e'tiborsiz qoldiramiz.
  void _onTyping(Map<String, dynamic> event) {
    if (event['conversationId'] != _conversationId) return;
    final userId = event['userId'] as String?;
    if (userId != null && userId == _myId) return;
    final current = state;
    if (current is! ConversationLoaded) return;
    emit(current.copyWith(peerTyping: event['isTyping'] == true));
  }

  /// Kelgan xabarni joriy ro'yxatga qo'shadi/almashtiradi:
  ///  1) shu `id` allaqachon bor -> joyida yangilaydi (edit/dublikat);
  ///  2) "mening" aks-sadom -> navbatdagi eng eski optimistik xabar o'rnini
  ///     egallaydi;
  ///  3) aks holda -> oxiriga qo'shiladi.
  void _mergeInbound(Message incoming) {
    final current = state;
    if (current is! ConversationLoaded) return;
    if (incoming.conversationId != _conversationId) return;

    final messages = [...current.messages];

    final existing = messages.indexWhere((m) => m.id == incoming.id);
    if (existing != -1) {
      messages[existing] = incoming;
      emit(current.copyWith(messages: _sorted(messages)));
      return;
    }

    if (incoming.isMine && _pendingLocalIds.isNotEmpty) {
      final localId = _pendingLocalIds.removeAt(0);
      final localIndex = messages.indexWhere((m) => m.id == localId);
      if (localIndex != -1) {
        messages[localIndex] = incoming;
        emit(current.copyWith(messages: _sorted(messages)));
        return;
      }
    }

    messages.add(incoming);
    emit(current.copyWith(messages: _sorted(messages)));
  }

  // ---- Yuborish yo'llari ----

  Future<String?> _sendViaUsecase({
    required String conversationId,
    required String localId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    final Either<Failure, Message> result;
    try {
      result = await _sendMessage(
        SendMessageParams(
          conversationId: conversationId,
          type: type,
          text: text,
          attachment: attachment,
          stickerId: stickerId,
        ),
      );
    } on Object catch (e) {
      _removeLocal(localId);
      return 'Kutilmagan xatolik: $e';
    }
    // `fold` ATAYLAB `try` blokidan tashqarida — natijani qaytarish (uni
    // "await qilinmagan Future" deb noto'g'ri belgilamasligi uchun).
    return result.fold(
      (failure) {
        _removeLocal(localId);
        return failure.message;
      },
      (sent) {
        _replaceLocal(localId, sent);
        return null;
      },
    );
  }

  Future<String?> _sendViaSocket({
    required String conversationId,
    required String localId,
    required MessageType type,
    String? text,
    ChatAttachment? attachment,
    String? stickerId,
  }) async {
    try {
      // Stiker kontrakt kind'lari (text|image|file|voice|video) orasida yo'q —
      // suhbatdosh ko'rishi uchun emoji matn xabar sifatida yuboriladi.
      if (type == MessageType.sticker) {
        _pendingLocalIds.add(localId);
        _socket.sendChat(
          conversationId: conversationId,
          kind: 'text',
          text: stickerEmoji(stickerId),
        );
        return null;
      }

      String? url;
      var fileName = attachment?.name;
      var fileSize = attachment?.sizeBytes;
      var durationSec = attachment?.durationMs == null
          ? null
          : (attachment!.durationMs! / 1000).round();

      if (attachment != null) {
        final path = attachment.path;
        final isRemote =
            path.startsWith('http://') || path.startsWith('https://');
        if (isRemote) {
          url = path;
        } else {
          final uploaded = await _uploads.upload(
            File(path),
            durationSec: durationSec,
          );
          url = uploaded.url;
          fileName = uploaded.fileName ?? fileName;
          fileSize = uploaded.fileSize ?? fileSize;
          durationSec = uploaded.durationSec ?? durationSec;
        }
      }

      _pendingLocalIds.add(localId);
      _socket.sendChat(
        conversationId: conversationId,
        kind: _kindToContract(type),
        text: text,
        url: url,
        fileName: fileName,
        fileSize: fileSize,
        durationSec: durationSec,
      );
      return null;
    } on ServerException catch (e) {
      _removeLocal(localId);
      return e.message;
    } on Object catch (e) {
      _removeLocal(localId);
      return 'Kutilmagan xatolik: $e';
    }
  }

  // ---- Mapper / yordamchilar ----

  /// Kontrakt `ChatMessage` JSON'ini (`{id, conversationId, senderId, kind,
  /// text?, fileName?, fileSize?, url?, durationSec?, status, createdAt}`)
  /// ilova [Message] entitisiga aylantiradi.
  Message _messageFromContract(Map<String, dynamic> json) {
    final senderId = json['senderId'] as String? ?? '';
    final type = _typeFromContract(json['kind'] as String?);
    final url = json['url'] as String?;
    final fileName = json['fileName'] as String?;
    final fileSize = (json['fileSize'] as num?)?.toInt();
    final durationSec = (json['durationSec'] as num?)?.toInt();
    final myId = _myId;
    final isMine = myId != null && senderId == myId;

    return Message(
      id:
          json['id'] as String? ??
          'RT-${DateTime.now().microsecondsSinceEpoch}',
      conversationId:
          json['conversationId'] as String? ?? _conversationId ?? '',
      senderId: senderId,
      senderName:
          json['senderName'] as String? ?? (isMine ? 'Siz' : 'Suhbatdosh'),
      isMine: isMine,
      type: type,
      text: json['text'] as String?,
      attachment: url == null
          ? null
          : ChatAttachment(
              kind: type,
              path: url,
              name: fileName,
              durationMs: durationSec == null ? null : durationSec * 1000,
              sizeBytes: fileSize,
            ),
      createdAt:
          json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      status: _statusFromContract(json['status'] as String?),
    );
  }

  /// Kontrakt kind -> ilova [MessageType] (`video` = doiraviy video xabar).
  MessageType _typeFromContract(String? kind) {
    return switch (kind) {
      'image' => MessageType.image,
      'file' => MessageType.file,
      'voice' => MessageType.voice,
      'video' => MessageType.roundVideo,
      _ => MessageType.text,
    };
  }

  /// Ilova [MessageType] -> kontrakt kind (`roundVideo` -> `video`).
  String _kindToContract(MessageType type) {
    return switch (type) {
      MessageType.image => 'image',
      MessageType.file => 'file',
      MessageType.voice => 'voice',
      MessageType.roundVideo => 'video',
      MessageType.text || MessageType.sticker => 'text',
    };
  }

  /// Kontrakt status -> ilova [MessageStatus].
  MessageStatus _statusFromContract(String? status) {
    return switch (status) {
      'read' => MessageStatus.oqildi,
      'delivered' => MessageStatus.yetkazildi,
      'sending' => MessageStatus.yuborilmoqda,
      _ => MessageStatus.yuborildi,
    };
  }

  List<Message> _sorted(List<Message> messages) {
    return [...messages]..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  }

  void _removeLocal(String localId) {
    _pendingLocalIds.remove(localId);
    final current = state;
    if (current is ConversationLoaded) {
      emit(
        current.copyWith(
          messages: current.messages.where((m) => m.id != localId).toList(),
        ),
      );
    }
  }

  void _replaceLocal(String localId, Message real) {
    final current = state;
    if (current is ConversationLoaded) {
      emit(
        current.copyWith(
          messages: [
            for (final m in current.messages)
              if (m.id == localId) real else m,
          ],
        ),
      );
    }
  }

  @override
  Future<void> close() {
    _teardownSocket();
    return super.close();
  }
}
