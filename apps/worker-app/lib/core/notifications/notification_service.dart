import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Odatiy (umumiy) bildirishnoma kanali IDsi.
const String kDefaultChannelId = 'hokimiyat_default';
const String kDefaultChannelName = 'Hokimiyat';

/// Kiruvchi qo'ng'iroq kanali — YUQORI muhimlik + to'liq-ekran intent
/// (qulflangan ekranda ham "jiringlash" ko'rinishi). Fon/yopiq holatda
/// kelgan `incoming_call` FCM push shu kanalda ko'rsatiladi.
const String kCallChannelId = 'hokimiyat_calls';
const String kCallChannelName = "Qo'ng'iroqlar";

/// Kiruvchi qo'ng'iroq bildirishnomasi payload prefiksi — bosilganda
/// [NotificationService.onIncomingCallTap] shu payloadni ajratadi.
const String kCallPayloadPrefix = 'incoming_call:';

/// Kiruvchi qo'ng'iroq bildirishnomasi barqaror ID — yangi push eskisini
/// almashtiradi (bir vaqtda bitta jiringlash).
const int kCallNotificationId = 424242;

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

  bool _initialized = false;

  /// Kiruvchi qo'ng'iroq bildirishnomasi bosilganda chaqiriladi
  /// (`bootstrap()`da ulanadi — socketni ulaydi va qo'ng'iroqni qabul
  /// qiladi). Bosh payload'dan `callId`/`callerName`/`media` ajratiladi.
  void Function(String callId, String callerName, String media)?
  onIncomingCallTap;

  /// Ilova bildirishnoma BOSILISHI orqali sovuq ishga tushgan bo'lsa —
  /// o'sha payload shu yerda ushlanadi va [dispatchLaunchTap] chaqirilganda
  /// yuboriladi (callback `bootstrap()`da ulangach).
  String? _pendingLaunchPayload;

  /// Plaginni ishga tushiradi (Android + iOS), qo'ng'iroq kanalini yaratadi
  /// va bildirishnoma ruxsatini so'raydi. Xavfsiz — istalgan xato ichkarida
  /// yutiladi, `init()` hech qachon `throw` qilmaydi.
  Future<void> init() async {
    if (_initialized) return;
    try {
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const darwinInit = DarwinInitializationSettings();
      const settings = InitializationSettings(
        android: androidInit,
        iOS: darwinInit,
      );
      await _plugin.initialize(
        settings,
        onDidReceiveNotificationResponse: _onResponse,
      );

      final androidImpl = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      await androidImpl?.createNotificationChannel(
        const AndroidNotificationChannel(
          kDefaultChannelId,
          kDefaultChannelName,
        ),
      );
      // Kiruvchi qo'ng'iroq kanali — max muhimlik (heads-up + ovoz).
      await androidImpl?.createNotificationChannel(
        const AndroidNotificationChannel(
          kCallChannelId,
          kCallChannelName,
          description: "Kiruvchi qo'ng'iroqlar",
          importance: Importance.max,
        ),
      );
      await androidImpl?.requestNotificationsPermission();

      final iosImpl = _plugin
          .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin
          >();
      await iosImpl?.requestPermissions(alert: true, badge: true, sound: true);

      // Bildirishnoma bosilishi orqali sovuq ishga tushirilganmi?
      final launch = await _plugin.getNotificationAppLaunchDetails();
      if (launch?.didNotificationLaunchApp ?? false) {
        final payload = launch?.notificationResponse?.payload;
        if (payload != null && payload.startsWith(kCallPayloadPrefix)) {
          _pendingLaunchPayload = payload;
        }
      }

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
        kDefaultChannelId,
        kDefaultChannelName,
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

  /// Kiruvchi qo'ng'iroq uchun to'liq-ekran (heads-up) bildirishnoma —
  /// foreground fallback (socket ulanmagan holatda) yoki iOS uchun.
  Future<void> showIncomingCall({
    required String callId,
    required String callerName,
    required String media,
  }) async {
    if (!_initialized) return;
    try {
      await _plugin.show(
        kCallNotificationId,
        callerName,
        media == 'video' ? "Video qo'ng'iroq" : "Ovozli qo'ng'iroq",
        _incomingCallDetails(),
        payload: _encodeCallPayload(
          callId: callId,
          callerName: callerName,
          media: media,
        ),
      );
    } on Object {
      // Ko'rsatib bo'lmasa — jim.
    }
  }

  /// Faol (ko'rsatilgan) kiruvchi qo'ng'iroq bildirishnomasini olib tashlaydi
  /// (qo'ng'iroq qabul qilingan/rad etilgan/tugagach).
  Future<void> cancelIncomingCall() async {
    if (!_initialized) return;
    try {
      await _plugin.cancel(kCallNotificationId);
    } on Object {
      // best-effort
    }
  }

  /// Sovuq ishga tushish (launch) payloadi bo'lsa — [onIncomingCallTap]ga
  /// yuboradi. `bootstrap()`da callback ulangach chaqiriladi.
  void dispatchLaunchTap() {
    final payload = _pendingLaunchPayload;
    if (payload == null) return;
    _pendingLaunchPayload = null;
    _dispatchCallPayload(payload);
  }

  void _onResponse(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) _dispatchCallPayload(payload);
  }

  void _dispatchCallPayload(String payload) {
    if (!payload.startsWith(kCallPayloadPrefix)) return;
    try {
      final json =
          jsonDecode(payload.substring(kCallPayloadPrefix.length))
              as Map<String, dynamic>;
      final callId = json['callId'] as String?;
      if (callId == null) return;
      onIncomingCallTap?.call(
        callId,
        json['callerName'] as String? ?? 'Nomaʼlum',
        json['media'] as String? ?? 'audio',
      );
    } on Object catch (e) {
      debugPrint('[notif] call payload parse error: $e');
    }
  }
}

/// Kiruvchi qo'ng'iroq bildirishnomasi tafsilotlari (max muhimlik +
/// to'liq-ekran intent + doimiy). Top-level — background isolate ham
/// ([showIncomingCallNotificationBackground]) shu tafsilotni ishlatadi.
NotificationDetails _incomingCallDetails() => const NotificationDetails(
  android: AndroidNotificationDetails(
    kCallChannelId,
    kCallChannelName,
    channelDescription: "Kiruvchi qo'ng'iroqlar",
    importance: Importance.max,
    priority: Priority.max,
    category: AndroidNotificationCategory.call,
    fullScreenIntent: true,
    ongoing: true,
    autoCancel: false,
    visibility: NotificationVisibility.public,
  ),
  iOS: DarwinNotificationDetails(
    presentAlert: true,
    presentBadge: true,
    presentSound: true,
    interruptionLevel: InterruptionLevel.timeSensitive,
  ),
);

String _encodeCallPayload({
  required String callId,
  required String callerName,
  required String media,
}) =>
    kCallPayloadPrefix +
    jsonEncode({'callId': callId, 'callerName': callerName, 'media': media});

/// FON/YOPIQ ISOLATE'da (FCM background handler) kiruvchi qo'ng'iroq
/// bildirishnomasini ko'rsatadi — o'z plagin nusxasini ishga tushiradi
/// (background isolate `NotificationService` singletoniga ega emas).
@pragma('vm:entry-point')
Future<void> showIncomingCallNotificationBackground({
  required String callId,
  required String callerName,
  required String media,
}) async {
  try {
    final plugin = FlutterLocalNotificationsPlugin();
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: androidInit);
    await plugin.initialize(settings);
    await plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            kCallChannelId,
            kCallChannelName,
            description: "Kiruvchi qo'ng'iroqlar",
            importance: Importance.max,
          ),
        );
    await plugin.show(
      kCallNotificationId,
      callerName,
      media == 'video' ? "Video qo'ng'iroq" : "Ovozli qo'ng'iroq",
      _incomingCallDetails(),
      payload: _encodeCallPayload(
        callId: callId,
        callerName: callerName,
        media: media,
      ),
    );
  } on Object {
    // Background bildirishnoma ko'rsatilmasa — jim (in-app ringing baribir
    // socket orqali ishlaydi).
  }
}
