import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/chat/domain/entities/message.dart';
import 'package:worker_app/features/chat/domain/usecases/get_messages.dart';
import 'package:worker_app/features/chat/domain/usecases/send_message.dart';

part 'conversation_state.dart';

/// Bitta suhbat sahifasini boshqaruvchi Cubit — xabarlar tarixini
/// yuklaydi va yangi xabar (matn/media/stiker) yuboradi.
///
/// [send] optimistik qo'shish qiladi: xabar darhol `yuborilmoqda` holatida
/// ro'yxatga qo'shiladi, so'ng haqiqiy natija bilan almashtiriladi
/// (muvaffaqiyatli bo'lsa — server qaytargan xabar bilan, odatda
/// `yuborildi` holatida; muvaffaqiyatsiz bo'lsa — ro'yxatdan olib
/// tashlanadi va xatolik matni chaqiruvchiga qaytariladi).
///
/// Hech qachon uncaught tashlamaydi — `RequestDetailCubit` bilan bir xil
/// naqsh: [open] muvaffaqiyatsizligi [ConversationError] holatiga
/// aylanadi; [send] muvaffaqiyatsizligi esa joriy [ConversationLoaded]ni
/// saqlab qolgan holda xatolik matnini qaytaradi (`Future<String?>` —
/// `null` bo'lsa muvaffaqiyatli).
class ConversationCubit extends Cubit<ConversationState> {
  ConversationCubit({
    required GetMessages getMessages,
    required SendMessage sendMessage,
  }) : _getMessages = getMessages,
       _sendMessage = sendMessage,
       super(const ConversationLoading());

  final GetMessages _getMessages;
  final SendMessage _sendMessage;

  /// So'nggi [open] bilan chaqirilgan suhbat ID — [retry]/[send] shu ID'ni
  /// ishlatadi.
  String? _conversationId;
  int _localIdSeq = 0;

  Future<void> open(String conversationId) async {
    _conversationId = conversationId;
    emit(const ConversationLoading());
    try {
      final result = await _getMessages(GetMessagesParams(conversationId));
      result.fold((failure) => emit(ConversationError(failure.message)), (
        messages,
      ) {
        final sorted = [...messages]
          ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
        emit(ConversationLoaded(sorted));
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
      senderId: 'me',
      senderName: 'Siz',
      isMine: true,
      type: type,
      text: text,
      attachment: attachment,
      stickerId: stickerId,
      createdAt: DateTime.now().toIso8601String(),
      status: MessageStatus.yuborilmoqda,
    );
    emit(ConversationLoaded([...current.messages, optimistic]));

    try {
      final result = await _sendMessage(
        SendMessageParams(
          conversationId: conversationId,
          type: type,
          text: text,
          attachment: attachment,
          stickerId: stickerId,
        ),
      );
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
    } on Object catch (e) {
      _removeLocal(localId);
      return 'Kutilmagan xatolik: $e';
    }
  }

  void _removeLocal(String localId) {
    final current = state;
    if (current is ConversationLoaded) {
      emit(
        ConversationLoaded(
          current.messages.where((m) => m.id != localId).toList(),
        ),
      );
    }
  }

  void _replaceLocal(String localId, Message real) {
    final current = state;
    if (current is ConversationLoaded) {
      emit(
        ConversationLoaded([
          for (final m in current.messages) m.id == localId ? real : m,
        ]),
      );
    }
  }
}
