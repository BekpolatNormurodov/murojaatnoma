import 'package:app_core/app_core.dart';

/// Serverdagi media manzilini to'liq URL'ga aylantiradi:
/// `/uploads/abc.jpg` → `https://<backend origin>/uploads/abc.jpg`.
///
/// Mutlaq http(s) URL va qurilmadagi lokal fayl yo'li (demo rejimda
/// yuklangan fayl o'rniga lokal yo'l qaytariladi) o'zgarishsiz qoladi.
String absoluteMediaUrl(String path) {
  if (path.isEmpty) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!path.startsWith('/uploads') && !path.startsWith('uploads/')) {
    return path;
  }
  final uri = Uri.tryParse(AppConfig.apiBaseUrl);
  if (uri == null || uri.host.isEmpty) return path;
  final origin =
      '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
  return path.startsWith('/') ? '$origin$path' : '$origin/$path';
}
