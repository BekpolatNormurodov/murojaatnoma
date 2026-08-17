import 'package:equatable/equatable.dart';
import 'package:worker_app/features/leave/domain/leave_request_validation.dart';

/// Xodim yuborgan "javob so'rash" (ta'til) so'rovining ko'rib chiqilish
/// holati.
enum LeaveRequestStatus { pending, approved, rejected }

/// Backend qaytaradigan (yaratilgan yoki ro'yxatdagi) ta'til so'rovi —
/// `POST /leave` va `GET /leave/me` javobidagi obyekt shakli.
class LeaveRequest extends Equatable {
  const LeaveRequest({
    required this.id,
    required this.type,
    required this.amount,
    required this.startDate,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.startTime,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'] as String,
      type: LeaveDurationType.values.byName(json['type'] as String),
      amount: (json['amount'] as num).toInt(),
      startDate: json['startDate'] as String,
      startTime: json['startTime'] as String?,
      reason: json['reason'] as String,
      status: LeaveRequestStatus.values.byName(json['status'] as String),
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final LeaveDurationType type;
  final int amount;

  /// ISO sana, masalan `'2026-08-20'`.
  final String startDate;

  /// `'HH:mm'` — faqat [LeaveDurationType.hours] uchun; kunlab
  /// so'ralganda (yoki soat tanlanmaganda) `null`.
  final String? startTime;
  final String reason;
  final LeaveRequestStatus status;

  /// ISO timestamp — so'rov yaratilgan payt.
  final String createdAt;

  @override
  List<Object?> get props => [
    id,
    type,
    amount,
    startDate,
    startTime,
    reason,
    status,
    createdAt,
  ];
}
