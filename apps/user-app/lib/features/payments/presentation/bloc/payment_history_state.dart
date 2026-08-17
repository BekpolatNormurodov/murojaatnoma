part of 'payment_history_cubit.dart';

/// To'lovlar tarixi sahifasining barcha holatlari.
sealed class PaymentHistoryState extends Equatable {
  const PaymentHistoryState();

  @override
  List<Object?> get props => [];
}

/// Yuklanmoqda — skeleton ro'yxat ko'rsatiladi.
class PaymentHistoryLoading extends PaymentHistoryState {
  const PaymentHistoryLoading();
}

/// Tarix muvaffaqiyatli yuklandi. [typeFilter] `null` bo'lsa barcha
/// turlar ko'rsatiladi — filtrlash mahalliy (qayta so'rovsiz) amalga
/// oshiriladi.
class PaymentHistoryLoaded extends PaymentHistoryState {
  const PaymentHistoryLoaded({required this.all, this.typeFilter});

  final List<Payment> all;
  final UtilityType? typeFilter;

  List<Payment> get filtered => typeFilter == null
      ? all
      : all.where((p) => p.type == typeFilter).toList();

  @override
  List<Object?> get props => [all, typeFilter];
}

/// Fuqaro hali birorta to'lov amalga oshirmagan.
class PaymentHistoryEmpty extends PaymentHistoryState {
  const PaymentHistoryEmpty();
}

/// Yuklashda xatolik yuz berdi — [message] "Qayta urinish" bilan
/// ko'rsatiladi.
class PaymentHistoryError extends PaymentHistoryState {
  const PaymentHistoryError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
