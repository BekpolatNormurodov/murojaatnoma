import 'package:user_app/features/notifications/domain/entities/notification_item.dart';

/// Fuqaro ilovasidagi bildirishnomalar uchun masofaviy ma'lumot manbai
/// SHARTNOMASI ("seam") — `NotificationsCubit` shu abstraksiyaga bog'liq,
/// aniq implementatsiyaga EMAS.
///
/// Hozircha yagona implementatsiya — [NotificationsMockDataSource] —
/// chunki fuqaroga qaratilgan (citizen-facing) `/notifications` backend
/// endpointi hali YO'Q (backenddagi `/notifications` hozircha faqat
/// xodim/admin uchun). Bu abstraksiya ATAYLAB, backend tayyor bo'lishidan
/// OLDIN kiritilgan: haqiqiy endpoint qo'shilganda shu shartnomaga mos
/// `NotificationsApiImpl` yozib, `NotificationsCubit`ning standart
/// argumentini (`dataSource ?? NotificationsMockDataSource()`) shunga
/// almashtirish YETARLI — chaqiruvchi kod (sahifa, DI ro'yxati) o'zgarmaydi.
/// `features/requests`dagi `CitizenRequestsRemoteDataSource`
/// (Mock/Api juftligi) bilan BIR XIL naqsh.
// ignore: one_member_abstracts
abstract class NotificationsDataSource {
  /// Ro'yxatni (eng yangisi birinchi bo'lishi shart emas — chaqiruvchi
  /// o'zi saralaydi) qaytaradi.
  Future<List<NotificationItem>> fetch();
}

/// MOCK implementatsiya — hozircha haqiqiy backend yo'q (mock-first,
/// `worker_app`dagi `NotificationsMockDataSource` bilan bir xil naqsh).
///
/// `title`/`body` ATAYLAB oddiy `String` (l10n kaliti EMAS) — vazifa
/// shartnomasiga ko'ra bildirishnoma MATNI (chrome emas) MOCK ma'lumot
/// qatlamining bir qismi.
class NotificationsMockDataSource implements NotificationsDataSource {
  /// Ro'yxatni (server kechikishini taqlid qilib) qaytaradi — eng
  /// yangisi birinchi. O'qilgan/o'qilmagan aralash, bir nechta turdagi
  /// yozuvlarni o'z ichiga oladi.
  @override
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
        body:
            '"Yo\'l ta\'mirlash" mavzusidagi murojaatingiz ko\'rib '
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
        body:
            '"Ko\'chani tozalash" murojaatingiz bajarildi deb '
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
