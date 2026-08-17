import 'package:user_app/features/notifications/domain/entities/notification_item.dart';

/// MOCK bildirishnomalar manbai — hozircha haqiqiy backend yo'q
/// (mock-first, `worker_app`dagi `NotificationsMockDataSource` bilan bir
/// xil naqsh). `NotificationsCubit` shu klassni bevosita ishlatadi.
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
        type: NotificationType.paymentSuccess,
        title: "To'lov muvaffaqiyatli amalga oshirildi",
        body: "Elektr energiyasi uchun 45 000 so'm to'landi.",
        createdAt: now.subtract(const Duration(minutes: 20)),
      ),
      NotificationItem(
        id: 'n2',
        type: NotificationType.requestAnswered,
        title: 'Murojaatingizga javob berildi',
        body: '"Yo\'l ta\'mirlash" mavzusidagi murojaatingiz ko\'rib '
            'chiqildi.',
        createdAt: now.subtract(const Duration(hours: 2)),
      ),
      NotificationItem(
        id: 'n3',
        type: NotificationType.serviceReminder,
        title: "Kommunal to'lov muddati yaqinlashmoqda",
        body: "Gaz xizmati uchun to'lov muddati 3 kundan so'ng tugaydi.",
        createdAt: now.subtract(const Duration(hours: 6)),
        read: true,
      ),
      NotificationItem(
        id: 'n4',
        type: NotificationType.paymentFailed,
        title: "To'lov amalga oshmadi",
        body: "Issiqlik ta'minoti uchun to'lov bank tomonidan rad etildi.",
        createdAt: now.subtract(const Duration(days: 1)),
        read: true,
      ),
      NotificationItem(
        id: 'n5',
        type: NotificationType.requestAnswered,
        title: 'Murojaatingiz holati yangilandi',
        body: '"Ko\'chani tozalash" murojaatingiz bajarildi deb '
            'belgilandi.',
        createdAt: now.subtract(const Duration(days: 2, hours: 4)),
      ),
      NotificationItem(
        id: 'n6',
        type: NotificationType.paymentSuccess,
        title: "To'lov muvaffaqiyatli amalga oshirildi",
        body: "Suv ta'minoti uchun 18 500 so'm to'landi.",
        createdAt: now.subtract(const Duration(days: 4)),
        read: true,
      ),
    ];
  }
}
