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
  });

  final CitizenRequest request;

  /// Murojaat mavzusidagi xabarlar (thread) — fuqaro savollari + xodim
  /// javoblari, xronologik tartibda. Xabarlarni yuklab bo'lmasa (masalan
  /// server xatosi) — bo'sh ro'yxat: butun sahifani xato holatiga
  /// aylantirmaydi, faqat thread bo'sh ko'rinadi.
  final List<RequestMessage> messages;

  /// `true` bo'lsa yangi xabar yuborilmoqda — composer tugmasi loading
  /// holatida.
  final bool sendingMessage;

  RequestDetailLoaded copyWith({
    CitizenRequest? request,
    List<RequestMessage>? messages,
    bool? sendingMessage,
  }) {
    return RequestDetailLoaded(
      request: request ?? this.request,
      messages: messages ?? this.messages,
      sendingMessage: sendingMessage ?? this.sendingMessage,
    );
  }

  @override
  List<Object?> get props => [request, messages, sendingMessage];
}

/// Murojaatni yuklashda xatolik (masalan topilmadi/server xatosi) —
/// [message] "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class RequestDetailError extends RequestDetailState {
  const RequestDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
