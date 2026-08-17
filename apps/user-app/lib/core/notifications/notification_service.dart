import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Qurilmadagi (on-device) HAQIQIY bildirishnomalarni ko'rsatuvchi
/// xizmat — `flutter_local_notifications` ustidan yupqa qatlam.
///
/// Ilova ildizida (`main.dart`, `bootstrap()`) BIR MARTA `init()`
/// chaqiriladi — `try/catch` bilan o'ralgan (qarang: chaqiruvchi joy),
/// shuning uchun ruxsat rad etilishi yoki platforma xatosi ilova
/// ishga tushishini HECH QACHON to'xtatmaydi.
class NotificationService {
  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static const _channelId = 'hokimiyat_default';
  static const _channelName = 'Hokimiyat';

  bool _initialized = false;

  /// Plaginni ishga tushiradi (Android + iOS) va bildirishnoma ruxsatini
  /// so'raydi. Xavfsiz — istalgan xato ichkarida yutiladi, `init()` hech
  /// qachon `throw` qilmaydi (chaqiruvchi baribir `try/catch` bilan
  /// o'raydi, lekin bu ikki qavatli himoya — xizmat o'zi ham mustahkam).
  Future<void> init() async {
    if (_initialized) return;
    try {
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const darwinInit = DarwinInitializationSettings();
      const settings = InitializationSettings(
        android: androidInit,
        iOS: darwinInit,
      );
      await _plugin.initialize(settings);

      final androidImpl = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      await androidImpl?.createNotificationChannel(
        const AndroidNotificationChannel(_channelId, _channelName),
      );
      await androidImpl?.requestNotificationsPermission();

      final iosImpl = _plugin
          .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin
          >();
      await iosImpl?.requestPermissions(alert: true, badge: true, sound: true);

      _initialized = true;
    } on Object {
      // Ruxsat rad etilgan/platforma qo'llab-quvvatlamaydi — jim
      // o'tkazib yuboriladi, `show()` keyinchalik shunchaki hech narsa
      // qilmaydi (`_initialized` `false`da qoladi).
    }
  }

  /// Darhol (bir martalik) mahalliy bildirishnoma ko'rsatadi. `init()`
  /// muvaffaqiyatsiz bo'lgan/hali chaqirilmagan bo'lsa — jim hech narsa
  /// qilmaydi (ilova hech qachon shu tufayli qulamaydi).
  Future<void> show({required String title, required String body}) async {
    if (!_initialized) return;
    try {
      const androidDetails = AndroidNotificationDetails(
        _channelId,
        _channelName,
      );
      const details = NotificationDetails(
        android: androidDetails,
        iOS: DarwinNotificationDetails(),
      );
      await _plugin.show(
        DateTime.now().millisecondsSinceEpoch.remainder(100000),
        title,
        body,
        details,
      );
    } on Object {
      // Ko'rsatib bo'lmasa — jim o'tkazib yuboriladi.
    }
  }
}
