import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_request_messages.dart';
import 'package:user_app/features/requests/domain/usecases/send_request_message.dart';

part 'request_detail_state.dart';

/// "Murojaat tafsilotlari" sahifasini boshqaruvchi Cubit — bitta ariza/
/// shikoyatni (+ uning xabarlar thread'ini) ID bo'yicha yuklaydi va fuqaro
/// nomidan yangi xabar yuborishga imkon beradi.
///
/// Fuqaro o'z murojaatiga rasmiy JAVOB yozmaydi/ball qo'ymaydi (bu — xodim
/// tomonidagi amal, worker-app'dagi `RequestDetailCubit`da), lekin xabarlar
/// thread'iga savol/izoh yozishi mumkin — shu tufayli faqat [sendMessage]
/// mutatsiya metodi bor.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [RequestDetailError] holatiga aylanadi.
class RequestDetailCubit extends Cubit<RequestDetailState> {
  RequestDetailCubit({
    required GetCitizenRequest getCitizenRequest,
    required GetRequestMessages getRequestMessages,
    required SendRequestMessage sendRequestMessage,
  }) : _getCitizenRequest = getCitizenRequest,
       _getRequestMessages = getRequestMessages,
       _sendRequestMessage = sendRequestMessage,
       super(const RequestDetailLoading());

  final GetCitizenRequest _getCitizenRequest;
  final GetRequestMessages _getRequestMessages;
  final SendRequestMessage _sendRequestMessage;

  /// So'nggi [load] bilan chaqirilgan ID — [retry]/[sendMessage]
  /// parametrsiz qayta yuklay olishi uchun saqlanadi.
  String? _lastId;

  Future<void> load(String id) async {
    _lastId = id;
    emit(const RequestDetailLoading());
    try {
      final result = await _getCitizenRequest(GetCitizenRequestParams(id));
      await result.fold(
        (failure) async => emit(RequestDetailError(failure.message)),
        (request) async {
          final messages = await _fetchMessages(id);
          emit(RequestDetailLoaded(request: request, messages: messages));
        },
      );
    } on Object catch (e) {
      emit(RequestDetailError('Kutilmagan xatolik: $e'));
    }
  }

  /// Xabarlarni (thread) alohida yuklaydi — muvaffaqiyatsizlik butun
  /// sahifani xato holatiga aylantirmaydi, faqat bo'sh ro'yxat qaytaradi
  /// (murojaatning o'zi allaqachon yuklangan, xabarlar ikkinchi darajali).
  Future<List<RequestMessage>> _fetchMessages(String id) async {
    try {
      final result = await _getRequestMessages(GetRequestMessagesParams(id));
      final messages = result.fold(
        (_) => const <RequestMessage>[],
        (messages) => messages,
      );
      return messages;
    } on Object catch (_) {
      return const [];
    }
  }

  /// So'nggi ishlatilgan ID bilan qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _lastId;
    return id == null ? Future<void>.value() : load(id);
  }

  /// Faqat xabarlar thread'ini qayta yuklaydi (pastga tortib yangilash) —
  /// butun sahifa skeleton holatiga qaytmaydi.
  Future<void> reloadMessages() async {
    final id = _lastId;
    final current = state;
    if (id == null || current is! RequestDetailLoaded) return;
    final messages = await _fetchMessages(id);
    emit(current.copyWith(messages: messages));
  }

  /// [text]ni fuqaro nomidan murojaat thread'iga yuboradi. Muvaffaqiyatli
  /// bo'lsa yangi xabar ro'yxatga qo'shiladi va `null` qaytadi; xatolik
  /// bo'lsa foydalanuvchiga ko'rsatsa bo'ladigan xabar matni qaytadi
  /// (sahifa buni `AppAlert.error` bilan ko'rsatadi).
  Future<String?> sendMessage(String text) async {
    final id = _lastId;
    final current = state;
    final trimmed = text.trim();
    if (id == null || current is! RequestDetailLoaded || trimmed.isEmpty) {
      return null;
    }

    emit(current.copyWith(sendingMessage: true));
    final result = await _sendRequestMessage(
      SendRequestMessageParams(id: id, text: trimmed),
    );

    return result.fold(
      (failure) {
        final latest = state;
        if (latest is RequestDetailLoaded) {
          emit(latest.copyWith(sendingMessage: false));
        }
        return failure.message;
      },
      (message) {
        final latest = state;
        final baseMessages = latest is RequestDetailLoaded
            ? latest.messages
            : current.messages;
        if (latest is RequestDetailLoaded) {
          emit(
            latest.copyWith(
              sendingMessage: false,
              messages: [...baseMessages, message],
            ),
          );
        }
        return null;
      },
    );
  }
}
