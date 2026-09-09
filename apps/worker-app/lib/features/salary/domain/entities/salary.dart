import 'package:equatable/equatable.dart';

/// Xodimning bitta oylik maosh yozuvi (`GET /salaries/me` javobidagi bitta
/// element). `net` = `amount + bonus - penalty` (backend hisoblab beradi).
///
/// `paidAt` `null`/bo'sh bo'lsa — maosh hali TO'LANMAGAN; ISO-8601 sana
/// bo'lsa — o'sha kuni to'langan.
class Salary extends Equatable {
  const Salary({
    required this.id,
    required this.year,
    required this.month,
    required this.amount,
    required this.bonus,
    required this.penalty,
    required this.net,
    required this.paidAt,
    this.note,
  });

  factory Salary.fromJson(Map<String, dynamic> json) {
    return Salary(
      id: json['id'] as String,
      year: (json['year'] as num).toInt(),
      month: (json['month'] as num).toInt(),
      amount: (json['amount'] as num).toInt(),
      bonus: (json['bonus'] as num?)?.toInt() ?? 0,
      penalty: (json['penalty'] as num?)?.toInt() ?? 0,
      net: (json['net'] as num).toInt(),
      note: json['note'] as String?,
      paidAt: json['paidAt'] as String?,
    );
  }

  final String id;

  /// Maosh yili (masalan 2026).
  final int year;

  /// Maosh oyi (1..12).
  final int month;

  /// Asosiy (bazaviy) maosh miqdori.
  final int amount;

  /// Ustama (bonus) — ijobiy, `net`ga qo'shiladi.
  final int bonus;

  /// Ushlab qolish (penalty/jarima) — `net`dan ayiriladi.
  final int penalty;

  /// Sof (qo'lga tegadigan) maosh: `amount + bonus - penalty`.
  final int net;

  /// Ixtiyoriy izoh.
  final String? note;

  /// To'langan sana (ISO-8601) yoki `null` — hali to'lanmagan.
  final String? paidAt;

  /// `true` bo'lsa — maosh to'langan (to'lov sanasi mavjud).
  bool get isPaid => paidAt != null && paidAt!.isNotEmpty;

  @override
  List<Object?> get props => [
    id,
    year,
    month,
    amount,
    bonus,
    penalty,
    net,
    note,
    paidAt,
  ];
}
