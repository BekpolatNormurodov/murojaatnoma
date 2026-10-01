import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Diskdagi GET javoblari keshi — internet yo'q/juda sekin bo'lganda
/// ekranlar oxirgi saqlangan ma'lumot bilan ochiladi.
///
/// Har yozuv alohida JSON fayl (`<hash>.json`: `{savedAt, data}`). Hajm
/// chegaralangan: [maxEntries] dan oshsa eng eskilari o'chiriladi, bitta
/// yozuv [maxEntryBytes] dan katta bo'lsa saqlanmaydi.
class ResponseCache {
  ResponseCache({Directory? directory}) : _dirOverride = directory;

  /// Ilova bo'yi umumiy instansiya.
  static final ResponseCache instance = ResponseCache();

  static const int maxEntries = 400;
  static const int maxEntryBytes = 1536 * 1024;

  final Directory? _dirOverride;
  Directory? _dir;
  int _writesSinceTrim = 0;

  Future<Directory> _directory() async {
    if (_dir != null) return _dir!;
    final base = _dirOverride ?? await getApplicationSupportDirectory();
    final dir = Directory('${base.path}/http_cache');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return _dir = dir;
  }

  /// Saqlangan javob yoki `null`.
  Future<CachedResponse?> read(String key) async {
    try {
      final file = File('${(await _directory()).path}/${_hash(key)}.json');
      if (!file.existsSync()) return null;
      final map = jsonDecode(await file.readAsString()) as Map<String, dynamic>;
      return CachedResponse(
        data: map['data'],
        savedAt: DateTime.parse(map['savedAt'] as String),
      );
    } on Object {
      return null;
    }
  }

  /// JSON'ga aylanadigan javobni saqlaydi (aks holda jim o'tkazadi).
  Future<void> write(String key, Object? data) async {
    try {
      final encoded = jsonEncode({
        'savedAt': DateTime.now().toIso8601String(),
        'data': data,
      });
      if (encoded.length > maxEntryBytes) return;
      final dir = await _directory();
      await File('${dir.path}/${_hash(key)}.json').writeAsString(encoded);
      if (++_writesSinceTrim >= 25) {
        _writesSinceTrim = 0;
        await _trim(dir);
      }
    } on Object {
      // Kesh — yordamchi; xato ilovani to'xtatmasin.
    }
  }

  /// Logout: boshqa xodim/fuqaro oldingi foydalanuvchi ma'lumotini ko'rmasin.
  Future<void> clear() async {
    try {
      final dir = await _directory();
      if (dir.existsSync()) await dir.delete(recursive: true);
      _dir = null;
    } on Object {
      // ignore
    }
  }

  Future<void> _trim(Directory dir) async {
    final files = dir.listSync().whereType<File>().toList();
    if (files.length <= maxEntries) return;
    files.sort(
      (a, b) => a.statSync().modified.compareTo(b.statSync().modified),
    );
    for (final f in files.take(files.length - maxEntries)) {
      try {
        f.deleteSync();
      } on Object {
        // ignore
      }
    }
  }

  /// Barqaror qisqa xesh (FNV-1a 64) — fayl nomi uchun.
  static String _hash(String input) {
    var h = 0xcbf29ce484222325;
    for (final unit in utf8.encode(input)) {
      h ^= unit;
      h = (h * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF;
    }
    return h.toUnsigned(64).toRadixString(16);
  }
}

/// Keshdan o'qilgan javob.
class CachedResponse {
  const CachedResponse({required this.data, required this.savedAt});

  final Object? data;
  final DateTime savedAt;
}
