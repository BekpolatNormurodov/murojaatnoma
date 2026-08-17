import 'package:worker_app/features/notifications/domain/entities/notification_item.dart';

/// MOCK bildirishnomalar manbai — `NotificationsRemoteDataSourceMockImpl`
/// (qarang: `notifications_remote_data_source.dart`) tomonidan o'rab
/// olinadi va `AppConfig.useMock` `true` bo'lganda ishlatiladi
/// (`ApplicationsRemoteDataSource` bilan bir xil Mock/Api naqshi).
///
/// `title`/`body` ATAYLAB oddiy `String` (l10n kaliti EMAS) — vazifa
/// shartnomasiga ko'ra bildirishnoma MATNI (chrome emas) MOCK ma'lumot
/// qatlamining bir qismi.
class NotificationsMockDataSource {
  /// Ro'yxatni (server kechikishini taqlid qilib) qaytaradi — eng
  /// yangisi birinchi. O'qilgan/o'qilmagan aralash, bir nechta turdagi
  /// yozuvlarni o'z ichiga oladi.
  Future<List<NotificationItem>> fetch() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final now = DateTime.now();
    return [
      NotificationItem(
        id: 'n1',
        type: NotificationType.checkInReminder,
        title: 'Davomatni belgilashni unutmang',
        body: 'Bugungi ish kuni uchun hali yuz bilan check-in qilmadingiz.',
        createdAt: now.subtract(const Duration(minutes: 12)),
      ),
      NotificationItem(
        id: 'n2',
        type: NotificationType.requestAssigned,
        title: 'Sizga yangi murojaat biriktirildi',
        body: '"Ko\'cha yoritilishi" mavzusidagi murojaat javobingizni '
            'kutmoqda.',
        createdAt: now.subtract(const Duration(hours: 1, minutes: 30)),
      ),
      NotificationItem(
        id: 'n3',
        type: NotificationType.meetingSoon,
        title: 'Majlis tez orada boshlanadi',
        body: '"Haftalik yig\'ilish" 15:00 da boshlanadi.',
        createdAt: now.subtract(const Duration(hours: 3)),
        read: true,
      ),
      NotificationItem(
        id: 'n4',
        type: NotificationType.leaveStatus,
        title: "So'rovingiz tasdiqlandi",
        body: "Ish vaqtidan ozod bo'lish so'rovingiz rahbar tomonidan "
            'tasdiqlandi.',
        createdAt: now.subtract(const Duration(days: 1, hours: 2)),
        read: true,
      ),
      NotificationItem(
        id: 'n5',
        type: NotificationType.requestAssigned,
        title: 'Sizga yana bir murojaat biriktirildi',
        body: '"Chiqindi tashish jadvali" bo\'yicha murojaat kelib '
            'tushdi.',
        createdAt: now.subtract(const Duration(days: 2)),
      ),
      NotificationItem(
        id: 'n6',
        type: NotificationType.checkInReminder,
        title: 'Kechagi davomat qayd etildi',
        body: 'Kecha soat 09:02 da muvaffaqiyatli check-in qildingiz.',
        createdAt: now.subtract(const Duration(days: 3, hours: 5)),
        read: true,
      ),
    ];
  }
}
