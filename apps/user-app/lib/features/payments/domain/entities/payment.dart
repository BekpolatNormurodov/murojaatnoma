import 'package:equatable/equatable.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';

/// [Payment.status] uchun ruxsat etilgan qiymatlar.
///
/// Oddiy `String` sifatida saqlanadi (enum emas) — mock/real backend
/// ikkalasi ham xuddi shu satrlarni qaytaradi deb kutiladi.
abstract class PaymentStatus {
  static const success = 'success';
  static const failed = 'failed';
  static const pending = 'pending';
}

/// Amalga oshirilgan (yoki urinilgan) bitta kommunal to'lov yozuvi.
class Payment extends Equatable {
  const Payment({
    required this.id,
    required this.type,
    required this.amount,
    required this.paidAt,
    required this.status,
    this.cardLast4,
  });

  /// `amount` JSON'da int yoki double kelishi mumkin — shuning uchun `num`
  /// orqali xavfsiz o'qiladi (int-safe).
  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['id'] as String,
      type: UtilityType.values.byName(json['type'] as String),
      amount: (json['amount'] as num).toDouble(),
      paidAt: json['paid_at'] as String,
      status: json['status'] as String,
      cardLast4: json['card_last4'] as String?,
    );
  }

  final String id;
  final UtilityType type;
  final double amount;

  /// To'lov vaqti (ISO `yyyy-MM-ddTHH:mm:ss`).
  final String paidAt;

  /// [PaymentStatus] qiymatlaridan biri.
  final String status;

  /// Mock karta raqamining oxirgi 4 xonasi — faqat ko'rsatish uchun, hech
  /// qachon to'liq karta raqami saqlanmaydi/uzatilmaydi.
  final String? cardLast4;

  @override
  List<Object?> get props => [id, type, amount, paidAt, status, cardLast4];

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.name,
    'amount': amount,
    'paid_at': paidAt,
    'status': status,
    'card_last4': cardLast4,
  };
}
