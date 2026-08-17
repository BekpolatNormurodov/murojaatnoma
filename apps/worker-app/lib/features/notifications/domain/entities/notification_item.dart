import 'package:equatable/equatable.dart';

/// Xodim ilovasidagi bildirishnoma turlari — har biri o'z ikonkasi/rangiga
/// ega (qarang: `NotificationTile`).
enum NotificationType {
  /// Kunlik davomat (yuz bilan check-in) haqida eslatma.
  checkInReminder,

  /// Xodimga yangi murojaat biriktirilgani haqida xabar.
  requestAssigned,

  /// Rejalashtirilgan majlis tez orada boshlanishi haqida eslatma.
  meetingSoon,

  /// Ish vaqtidan ozod bo'lish (`/leave-request`) so'rovi holati
  /// o'zgargani haqida xabar.
  leaveStatus,
}

/// Bitta bildirishnoma yozuvi — ro'yxat sahifasida (`NotificationsPage`)
/// ko'rsatiladi. MOCK manbadan (`NotificationsMockDataSource`) keladi —
/// `title`/`body` shu tufayli ATAYLAB oddiy `String` (l10n emas, qarang:
/// data qatlami hujjati).
class NotificationItem extends Equatable {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.read = false,
  });

  final String id;
  final NotificationType type;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool read;

  NotificationItem copyWith({bool? read}) => NotificationItem(
    id: id,
    type: type,
    title: title,
    body: body,
    createdAt: createdAt,
    read: read ?? this.read,
  );

  @override
  List<Object?> get props => [id, type, title, body, createdAt, read];
}
