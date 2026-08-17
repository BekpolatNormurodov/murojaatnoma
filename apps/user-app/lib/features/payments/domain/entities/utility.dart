import 'package:equatable/equatable.dart';

/// Kommunal xizmat turi.
enum UtilityType { elektr, gaz, suv, issiqlik, chiqindi }

/// Fuqaroga biriktirilgan bitta kommunal xizmat hisobi — provayder, hisob
/// raqami va joriy qarzdorlik summasi.
class Utility extends Equatable {
  const Utility({
    required this.id,
    required this.type,
    required this.provider,
    required this.accountNumber,
    required this.balanceDue,
    required this.lastInvoiceAt,
  });

  /// `balance_due` JSON'da int yoki double kelishi mumkin — shuning uchun
  /// `num` orqali xavfsiz o'qiladi (int-safe).
  factory Utility.fromJson(Map<String, dynamic> json) {
    return Utility(
      id: json['id'] as String,
      type: UtilityType.values.byName(json['type'] as String),
      provider: json['provider'] as String,
      accountNumber: json['account_number'] as String,
      balanceDue: (json['balance_due'] as num).toDouble(),
      lastInvoiceAt: json['last_invoice_at'] as String,
    );
  }

  final String id;
  final UtilityType type;
  final String provider;
  final String accountNumber;

  /// Joriy qarzdorlik summasi (so'mda) — `0` bo'lsa qarz yo'q.
  final double balanceDue;

  /// Oxirgi hisoblangan sana (`yyyy-MM-dd`).
  final String lastInvoiceAt;

  @override
  List<Object?> get props => [
    id,
    type,
    provider,
    accountNumber,
    balanceDue,
    lastInvoiceAt,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.name,
    'provider': provider,
    'account_number': accountNumber,
    'balance_due': balanceDue,
    'last_invoice_at': lastInvoiceAt,
  };
}
