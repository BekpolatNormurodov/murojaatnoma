import 'package:equatable/equatable.dart';

/// Xodim ilovasidagi bildirishnoma turlari — har biri o'z ikonkasi/rangiga
/// ega (qarang: `NotificationTile`).
enum NotificationType {
  /// Kunlik davomat (yuz bilan check-in) haqida eslatma.
  ///
  /// Backend `NotificationType.ATTENDANCE`ga mos keladi (qarang:
  /// `notificationTypeFromApi`).
  checkInReminder,

  /// Xodimga yangi murojaat biriktirilgani haqida xabar.
  ///
  /// Backend `NotificationType.APPLICATION`ga mos keladi.
  requestAssigned,

  /// Rejalashtirilgan majlis tez orada boshlanishi haqida eslatma.
  ///
  /// Backendda hozircha mos turi YO'Q — faqat MOCK ma'lumotlarda uchraydi.
  meetingSoon,

  /// Ish vaqtidan ozod bo'lish (`/leave-request`) so'rovi holati
  /// o'zgargani haqida xabar.
  ///
  /// Backendda hozircha mos turi YO'Q — faqat MOCK ma'lumotlarda uchraydi.
  leaveStatus,

  /// Umumiy/tasniflanmagan bildirishnoma.
  ///
  /// Backend `NotificationType.GENERAL`ga (va tanilmagan/`null` turlarga)
  /// mos keladi.
  general,

  /// Xodim joylashuvi (geofence) bo'yicha ogohlantirish.
  ///
  /// Backend `NotificationType.LOCATION`ga mos keladi.
  locationAlert,
}

/// Backend `Notification.type` qiymatini (`GENERAL`/`ATTENDANCE`/
/// `APPLICATION`/`LOCATION`, qarang: `apps/backend/prisma/schema.prisma`)
/// mahalliy [NotificationType]ga aylantiradi. Tanilmagan/`null` qiymat
/// jim ravishda [NotificationType.general]ga tushadi — noma'lum kelajakdagi
/// backend turlari ilovani BUZMASLIGI kerak.
NotificationType notificationTypeFromApi(String? raw) => switch (raw) {
  'ATTENDANCE' => NotificationType.checkInReminder,
  'APPLICATION' => NotificationType.requestAssigned,
  'LOCATION' => NotificationType.locationAlert,
  _ => NotificationType.general,
};

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

  /// Backend javobidan (`GET /notifications/employee/:employeeId`,
  /// `PATCH /notifications/:id/read`) yasaydi — maydon nomlari Prisma
  /// `Notification` modeliga mos (camelCase, qarang: `schema.prisma`):
  /// `id`, `title`, `body`, `type`, `isRead`, `createdAt`.
  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      type: notificationTypeFromApi(json['type'] as String?),
      title: json['title'] as String,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      read: json['isRead'] as bool? ?? false,
    );
  }

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
