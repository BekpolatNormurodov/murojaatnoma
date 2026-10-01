import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';

/// Yuz tekshiruvidan o'tgan kadrni serverga yuklaydi — URL check-in/out
/// so'roviga qo'shiladi va davomat yozuvida "kim keldi" isboti bo'lib
/// qoladi (web-admin va xodimning o'z tarixida ko'rinadi).
// ignore: one_member_abstracts
abstract class ScanPhotoUploader {
  /// Muvaffaqiyatda URL, aks holda `null` — rasm yuklanmasa ham davomat
  /// to'xtamaydi (isbotsiz yoziladi).
  Future<String?> upload(String path);
}

class ApiScanPhotoUploader implements ScanPhotoUploader {
  ApiScanPhotoUploader(
    this._client, {
    this.timeout = const Duration(seconds: 8),
  });

  final DioClient _client;
  final Duration timeout;

  @override
  Future<String?> upload(String path) async {
    try {
      final file = File(path);
      if (!file.existsSync()) return null;
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          path,
          filename: 'scan-${DateTime.now().millisecondsSinceEpoch}.jpg',
          // Server faqat image/video/audio qabul qiladi.
          contentType: DioMediaType('image', 'jpeg'),
        ),
      });
      final res = await _client.dio
          .post<Map<String, dynamic>>('/uploads', data: form)
          .timeout(timeout);
      final url = res.data?['url'];
      return url is String && url.isNotEmpty ? url : null;
    } on Object {
      return null;
    }
  }
}
