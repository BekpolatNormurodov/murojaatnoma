part of 'request_detail_cubit.dart';

/// "Murojaat tafsilotlari" sahifasining barcha holatlari.
sealed class RequestDetailState extends Equatable {
  const RequestDetailState();

  @override
  List<Object?> get props => [];
}

/// Murojaat yuklanmoqda (yoki qayta yuklanmoqda — "Qayta urinish").
class RequestDetailLoading extends RequestDetailState {
  const RequestDetailLoading();
}

/// Murojaat muvaffaqiyatli yuklandi.
class RequestDetailLoaded extends RequestDetailState {
  const RequestDetailLoaded({
    required this.request,
    this.messages = const [],
    this.sendingMessage = false,
    this.messagesFailed = false,
  });

  final CitizenRequest request;

  /// Murojaat mavzusidagi xabarlar (thread) — fuqaro savollari + xodim
  /// javoblari, xronologik tartibda.
  final List<RequestMessage> messages;

  /// `true` bo'lsa yangi xabar yuborilmoqda — composer tugmasi loading
  /// holatida.
  final bool sendingMessage;

  /// Thread'ni oxirgi marta yuklab bo'lmadi — [messages] eski (yoki bo'sh)
  /// bo'lib qoladi, sahifa xato va "Qayta urinish" ko'rsatadi.
  final bool messagesFailed;

  RequestDetailLoaded copyWith({
    CitizenRequest? request,
    List<RequestMessage>? messages,
    bool? sendingMessage,
    bool? messagesFailed,
  }) {
    return RequestDetailLoaded(
      request: request ?? this.request,
      messages: messages ?? this.messages,
      sendingMessage: sendingMessage ?? this.sendingMessage,
      messagesFailed: messagesFailed ?? this.messagesFailed,
    );
  }

  @override
  List<Object?> get props => [
    request,
    messages,
    sendingMessage,
    messagesFailed,
  ];
}

/// Murojaatni yuklashda xatolik (masalan topilmadi/server xatosi) —
/// [message] "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class RequestDetailError extends RequestDetailState {
  const RequestDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
