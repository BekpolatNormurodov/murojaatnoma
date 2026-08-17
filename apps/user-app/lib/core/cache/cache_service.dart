import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// `SharedPreferences` ustidagi yupqa, ixtiyoriy TTL (yashash muddati)ga
/// ega JSON keshlash xizmati.
///
/// "Cache-then-network" naqshi uchun mo'ljallangan: ro'yxat ekranlari
/// avval [getJson]/[getJsonList] orqali oxirgi keshni darhol ko'rsatishi,
/// so'ng tarmoqdan yangi ma'lumot kelganda uni yangilashi mumkin.
/// [isFresh] tarmoqqa qayta murojaat qilish kerak-kerak emasligini
/// aniqlash uchun ishlatiladi.
///
/// Har bir kalit uchun ikkita `SharedPreferences` yozuvi saqlanadi:
/// `key` (JSON matni) va `key__ts` (agar TTL berilgan bo'lsa — muddati
/// tugash vaqti, millisekundlarda, epoxadan).
class CacheService {
  CacheService(this._prefs);

  final SharedPreferences _prefs;

  static const _timestampSuffix = '__ts';

  String _timestampKey(String key) => '$key$_timestampSuffix';

  /// [value]ni (allaqachon JSON-mos — `Map`/`List`/primitiv) `key` ostida
  /// saqlaydi. [ttl] berilsa, muddati shu vaqt o'tgach [isFresh] `false`
  /// qaytaradi (lekin ma'lumotning o'zi [getJson]/[getJsonList] orqali
  /// hamon o'qilishi mumkin — eskirgan keshni ham "darhol ko'rsatish"
  /// uchun).
  Future<void> setJson(String key, Object? value, {Duration? ttl}) async {
    // Caching is best-effort: a non-encodable value or a storage failure must
    // never crash the caller (mirrors the read path's null-return contract).
    try {
      await _prefs.setString(key, jsonEncode(value));
      if (ttl != null) {
        final expiresAt = DateTime.now().add(ttl).millisecondsSinceEpoch;
        await _prefs.setInt(_timestampKey(key), expiresAt);
      } else {
        await _prefs.remove(_timestampKey(key));
      }
    } on Object catch (_) {
      // Swallow: failing to write the cache is non-fatal.
    }
  }

  /// `key` ostida saqlangan bitta JSON obyektni o'qiydi va [fromJson]
  /// orqali `T`ga aylantiradi. Kalit topilmasa yoki JSON buzilgan/kutilgan
  /// shaklda bo'lmasa — `null` qaytaradi (hech qachon `throw` qilmaydi).
  T? getJson<T>(String key, T Function(Map<String, dynamic> json) fromJson) {
    final raw = _prefs.getString(key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      return fromJson(decoded);
    } on Object catch (_) {
      // Catch Object (not just Exception): a schema-drifted cache entry makes
      // fromJson throw a CastError/TypeError (an Error), which must also fall
      // back to null so a stale cache never crashes the screen.
      return null;
    }
  }

  /// [getJson]ning ro'yxat (`List<Map>`) varianti — ro'yxat ekranlarining
  /// keshini o'qish uchun.
  List<T>? getJsonList<T>(
    String key,
    T Function(Map<String, dynamic> json) fromJson,
  ) {
    final raw = _prefs.getString(key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return null;
      return decoded
          .whereType<Map<String, dynamic>>()
          .map(fromJson)
          .toList();
    } on Object catch (_) {
      // Catch Object (not just Exception): a schema-drifted cache entry makes
      // fromJson throw a CastError/TypeError (an Error), which must also fall
      // back to null so a stale cache never crashes the screen.
      return null;
    }
  }

  /// `key` uchun mos ma'lumot mavjud va TTL muddati hali tugamaganmi
  /// (yoki TTL umuman berilmagan bo'lsa — shunchaki mavjudmi).
  bool isFresh(String key) {
    if (!_prefs.containsKey(key)) return false;
    final expiresAt = _prefs.getInt(_timestampKey(key));
    if (expiresAt == null) return true;
    return DateTime.now().millisecondsSinceEpoch < expiresAt;
  }

  /// `key` (va uning TTL yozuvini) keshdan olib tashlaydi.
  Future<void> remove(String key) async {
    await _prefs.remove(key);
    await _prefs.remove(_timestampKey(key));
  }
}
