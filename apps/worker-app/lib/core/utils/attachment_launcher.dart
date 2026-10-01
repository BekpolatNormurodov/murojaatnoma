import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Yuborilgan fayl biriktirmasining (`ChatAttachment`/`AttachmentRef` ning
/// `path`ini) qurilma brauzeri / standart ilovada ochadi.
///
/// `path` odatda mutlaq https URL (masalan
/// `https://murojaatnoma.uz/uploads/<id>.<ext>`); nisbiy bo'lsa backend
/// origini ([AppConfig.apiBaseUrl] dan `/api` prefiksi kesilgan) bilan
/// to'ldiriladi. Ochib bo'lmasa "Faylni ochib bo'lmadi" xabari ko'rsatiladi
/// (bu rasm/ovoz/video emas — faqat generic hujjat qatorlari uchun).
Future<void> openAttachmentUrl(BuildContext context, String path) async {
  final uri = Uri.tryParse(_resolve(path));
  var opened = false;
  if (uri != null) {
    try {
      opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } on Object {
      opened = false;
    }
  }
  if (!opened && context.mounted) {
    AppAlert.error(context, "Faylni ochib bo'lmadi");
  }
}

/// Mutlaq http(s) URL bo'lsa o'zini qaytaradi; aks holda backend origini
/// bilan to'ldiradi.
String _resolve(String path) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final origin = _origin(AppConfig.apiBaseUrl);
  return path.startsWith('/') ? '$origin$path' : '$origin/$path';
}

/// `https://murojaatnoma.uz/api` -> `https://murojaatnoma.uz` (yo'lsiz origin)
/// — `realtime_socket_service` bilan bir xil mantiq.
String _origin(String base) {
  final uri = Uri.parse(base);
  final port = uri.hasPort ? ':${uri.port}' : '';
  return '${uri.scheme}://${uri.host}$port';
}
