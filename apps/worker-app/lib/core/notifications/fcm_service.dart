import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:worker_app/core/notifications/notification_service.dart';

/// FCM (masofaviy push) xizmati — `firebase_messaging` ustidan yupqa qatlam.
///
/// Vazifasi:
///  * qurilma FCM tokenini olib backendga ro'yxatdan o'tkazadi
///    (`POST /notifications/device-token`) va token yangilanganda qayta yuboradi;
///  * ilova OCHIQ turganda kelgan push'ni mahalliy bildirishnomaga
///    (`NotificationService`) aylantiradi — fon/yopiq holatda tizim o'zi
///    ko'rsatadi (qarang: [firebaseMessagingBackgroundHandler]).
///
/// Har bir amal HIMOYALANGAN — push ishlamay qolsa (ruxsat rad etilsa,
/// tarmoq yo'q, yoki sessiya hali yo'q bo'lsa) ilova HECH QACHON qulamaydi.
class FcmService {
  FcmService(this._dio, this._local);

  final Dio _dio;
  final NotificationService _local;
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;

  bool _handlersReady = false;

  /// Ruxsat so'raydi, foreground handler'larni ulaydi va (agar sessiya
  /// mavjud bo'lsa) tokenni backendga yuboradi. `throw` qilmaydi.
  Future<void> init() async {
    try {
      await _messaging.requestPermission();
      // iOS'da ilova ochiqligida ham banner/sound chiqishi uchun.
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      if (!_handlersReady) {
        FirebaseMessaging.onMessage.listen(_onForegroundMessage);
        _messaging.onTokenRefresh.listen(_sendToken);
        _handlersReady = true;
      }

      await syncToken();
    } on Object {
      // Push sozlanmasa — jim o'tkazib yuboriladi.
    }
  }

  /// Joriy tokenni backendga (qayta) ro'yxatdan o'tkazadi. Login'dan keyin
  /// chaqirish uchun ochiq — o'shanda sessiya mavjud, Dio auth header qo'yadi.
  Future<void> syncToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _sendToken(token);
      }
    } on Object {
      // best-effort
    }
  }

  Future<void> _sendToken(String token) async {
    try {
      await _dio.post<void>(
        '/notifications/device-token',
        data: <String, String>{
          'token': token,
          'platform': Platform.isIOS ? 'IOS' : 'ANDROID',
        },
      );
    } on Object {
      // Sessiya yo'q (401) yoki tarmoq xatosi — keyingi login/refresh yoki
      // token yangilanishida qayta urinadi.
    }
  }

  /// Logout'da tokenni o'chiradi — foydalanuvchi endi push olmaydi.
  Future<void> clearToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _dio.delete<void>(
          '/notifications/device-token',
          data: <String, String>{'token': token},
        );
      }
    } on Object {
      // best-effort
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) {
      return;
    }
    _local.show(
      title: notification.title ?? '',
      body: notification.body ?? '',
    );
  }
}

/// Ilova FONDA/YOPIQ holatda kelgan push uchun top-level handler. FCM tizim
/// bildirishnomasini AVTOMATIK ko'rsatadi, shuning uchun bu yerda qo'shimcha
/// ish shart emas — lekin handler RO'YXATDAN O'TKAZILISHI shart
/// (`FirebaseMessaging.onBackgroundMessage`), aks holda ba'zi platformalarda
/// data-message umuman yetkazilmaydi.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Tizim push'ni o'zi ko'rsatadi; alohida ish talab qilinmaydi.
}
