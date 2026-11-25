import 'dart:convert';
import 'dart:io';

import 'package:flutter/painting.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/face/data/services/citizen_face_sync.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';

/// Qurilmadagi fuqaroga tegishli ma'lumotlarning EGASINI nazorat qiladi.
///
/// Profil, yuz shabloni, yuz rasmlari va PIN global kalitlarda saqlanadi.
/// Shu telefonda boshqa raqam bilan kirilsa, ular o'chiriladi; o'sha fuqaro
/// qayta kirsa — saqlanib qoladi (qayta ro'yxatdan o'tmaydi). Ro'yxat
/// keshlari esa har chiqishda tozalanadi.
class AccountDataStore {
  AccountDataStore({
    required FlutterSecureStorage storage,
    required SharedPreferences prefs,
    CitizenFaceSync? faceSync,
    Future<Directory> Function()? documentsDirectory,
  }) : _storage = storage,
       _prefs = prefs,
       _faceSync = faceSync,
       _documentsDirectory =
           documentsDirectory ?? getApplicationDocumentsDirectory;

  final FlutterSecureStorage _storage;
  final SharedPreferences _prefs;
  final CitizenFaceSync? _faceSync;
  final Future<Directory> Function() _documentsDirectory;
  static const _logger = AppLogger();

  static const ownerKey = 'citizen_data_owner';
  static const profileKey = 'citizen_profile';
  static const templateKey = 'face_template';
  static const pinHashKey = 'pin_hash';
  static const pinAttemptsKey = 'pin_failed_attempts';

  /// Fuqaroga tegishli `SharedPreferences` keshlari (prefiks bo'yicha —
  /// `__ts` va `requests_cache_v1::*` yozuvlari ham shu ichida).
  static const cachePrefixes = [
    'requests_cache_v1',
    Utility.cacheKey,
    Payment.cacheKey,
    NotificationItem.cacheKey,
  ];

  static String _normalize(String value) =>
      value.replaceAll(RegExp('[^0-9]'), '');

  /// [session] egasi uchun mahalliy ma'lumotni tayyorlaydi: begona bo'lsa
  /// o'chiradi, so'ng egani yozib qo'yadi.
  ///
  /// Egasi yozilmagan (eski versiyadan qolgan) ma'lumot: yuz shablonidagi
  /// `owner_id` mos kelsa saqlanadi; shablon bo'lmasa faqat [restored]
  /// (allaqachon kirgan sessiya) holatida saqlanadi.
  ///
  /// O'chirib bo'lmasa xato tashlaydi — chaqiruvchi begona ma'lumotni
  /// tiklamasligi kerak.
  Future<void> claim(AuthSession session, {required bool restored}) async {
    final me = _normalize(session.phone);
    final owner = await _storage.read(key: ownerKey);
    final bool mine;
    if (owner != null) {
      mine = owner == me;
    } else {
      final templateOwner = await _templateOwner();
      mine = templateOwner == null
          ? restored
          : templateOwner == session.userId || _normalize(templateOwner) == me;
    }
    if (!mine) await wipeAccountData();
    if (owner != me) await _storage.write(key: ownerKey, value: me);
  }

  Future<String?> _templateOwner() async {
    final raw = await _storage.read(key: templateKey);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      final id = decoded is Map ? decoded['owner_id'] : null;
      return id is String && id.isNotEmpty ? id : null;
    } on FormatException {
      return null;
    }
  }

  /// Joriy sessiya ma'lumotlari: ro'yxat keshlari va xotiradagi yuz URL'i.
  Future<void> clearSessionData() async {
    _faceSync?.reset();
    final keys = _prefs
        .getKeys()
        .where((k) => cachePrefixes.any(k.startsWith))
        .toList();
    for (final key in keys) {
      await _prefs.remove(key);
    }
  }

  /// PIN va urinishlar hisobini o'chiradi ("PIN kodni unutdim").
  Future<void> clearPin() async {
    await _storage.delete(key: pinHashKey);
    await _storage.delete(key: pinAttemptsKey);
  }

  /// Fuqaroning qurilmadagi barcha shaxsiy ma'lumotlarini o'chiradi.
  Future<void> wipeAccountData() async {
    await clearSessionData();
    await clearPin();
    await _storage.delete(key: profileKey);
    await _storage.delete(key: templateKey);
    await _storage.delete(key: ownerKey);
    try {
      final docs = await _documentsDirectory();
      final faceDir = Directory('${docs.path}/face');
      if (faceDir.existsSync()) faceDir.deleteSync(recursive: true);
      // Rasm keshi fayl yo'li bo'yicha — yangi fuqaroning shu nomdagi
      // rasmi o'rniga eskisi chiqmasin.
      PaintingBinding.instance.imageCache
        ..clear()
        ..clearLiveImages();
    } on Object catch (e, stackTrace) {
      // Rasm o'chmasa — kirish baribir to'xtamasin, lekin yozib qo'yamiz.
      _logger.logError(e, stackTrace, reason: 'AccountDataStore.wipe photos');
    }
  }
}
