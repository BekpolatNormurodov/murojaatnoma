part of 'conversation_cubit.dart';

/// Bitta suhbat sahifasining barcha holatlari.
///
/// `sealed` — sahifadagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi. Bo'sh suhbat (hali xabar yo'q) alohida
/// holat EMAS — [ConversationLoaded] ichida bo'sh ro'yxat sifatida
/// ifodalanadi va sahifa buni ichki `EmptyState` bilan ko'rsatadi (chat
/// ro'yxatidagi bilan solishtirganda: yangi shaxsiy/guruh suhbat hali
/// xabarsiz bo'lishi tabiiy holat, xatolik emas).
sealed class ConversationState extends Equatable {
  const ConversationState();

  @override
  List<Object?> get props => [];
}

/// `open()` boshlanganda (yoki "Qayta urinish") — xabarlar skeleton
/// ko'rsatadi.
class ConversationLoading extends ConversationState {
  const ConversationLoading();
}

/// Xabarlar tarixi muvaffaqiyatli yuklandi (bo'sh bo'lishi ham mumkin).
/// Xronologik tartibda (eskisidan yangisiga) — ro'yxat pastiga skroll
/// qilinadi.
///
/// [peerTyping] — suhbatdosh hozir yozayotgan bo'lsa `true` (jonli
/// `chat:typing` eventi orqali) — sarlavhada "yozmoqda..." ko'rsatiladi.
/// Mock/oflayn rejimda doim `false`.
class ConversationLoaded extends ConversationState {
  const ConversationLoaded(this.messages, {this.peerTyping = false});

  final List<Message> messages;
  final bool peerTyping;

  ConversationLoaded copyWith({List<Message>? messages, bool? peerTyping}) {
    return ConversationLoaded(
      messages ?? this.messages,
      peerTyping: peerTyping ?? this.peerTyping,
    );
  }

  @override
  List<Object?> get props => [messages, peerTyping];
}

/// Xabarlarni yuklashda xatolik (server yoki kutilmagan) — [message]
/// "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class ConversationError extends ConversationState {
  const ConversationError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
