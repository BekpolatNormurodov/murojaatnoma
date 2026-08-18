import 'package:equatable/equatable.dart';

/// Xodim yuborgan "premya so'rash" (mukofot) so'rovining ko'rib chiqilish
/// holati.
enum BonusRequestStatus { pending, approved, rejected }

/// Backend qaytaradigan (yaratilgan yoki ro'yxatdagi) premya so'rovi —
/// `POST /premya` va `GET /premya/me` javobidagi obyekt shakli.
class BonusRequest extends Equatable {
  const BonusRequest({
    required this.id,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.amount,
  });

  factory BonusRequest.fromJson(Map<String, dynamic> json) {
    return BonusRequest(
      id: json['id'] as String,
      amount: (json['amount'] as num?)?.toInt(),
      reason: json['reason'] as String,
      status: BonusRequestStatus.values.byName(json['status'] as String),
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;

  /// So'ralayotgan mukofot summasi (so'mda) — ixtiyoriy, ko'rsatilmasa
  /// `null`.
  final int? amount;
  final String reason;
  final BonusRequestStatus status;

  /// ISO timestamp — so'rov yaratilgan payt.
  final String createdAt;

  @override
  List<Object?> get props => [id, amount, reason, status, createdAt];
}
