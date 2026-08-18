import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';

/// `POST /uploads` javobi — serverda saqlangan media haqidagi ma'lumot.
///
/// Faqat `url` majburiy; qolgan maydonlar server qaytarsa to'ldiriladi
/// (aks holda chaqiruvchi mahalliy fayldan bilgan qiymatlariga tushadi).
class UploadedMedia {
  const UploadedMedia({
    required this.url,
    this.fileName,
    this.fileSize,
    this.mimeType,
    this.durationSec,
  });

  factory UploadedMedia.fromJson(Map<String, dynamic> json) {
    return UploadedMedia(
      url: json['url'] as String? ?? '',
      fileName: json['fileName'] as String?,
      fileSize: (json['fileSize'] as num?)?.toInt(),
      mimeType: json['mimeType'] as String?,
      durationSec: (json['durationSec'] as num?)?.toInt(),
    );
  }

  /// Serverdagi ochiq (http/https) media manzili — `chat:send`da `url`
  /// sifatida yuboriladi.
  final String url;

  /// Fayl nomi (server bermasa `null`).
  final String? fileName;

  /// Fayl hajmi (baytlarda).
  final int? fileSize;

  /// MIME-turi (masalan `image/jpeg`, `audio/m4a`).
  final String? mimeType;

  /// Ovoz/doiraviy video davomiyligi (soniyalarda).
  final int? durationSec;
}

/// Chat media biriktirmalarini (rasm/fayl/ovoz/doiraviy video) serverga
/// yuklaydigan xizmat — mahalliy fayl -> ochiq URL.
///
/// `chat:send` faqat URL bilan ishlagani uchun (mahalliy fayl yo'li EMAS),
/// har bir media xabar avval SHU yerda yuklanadi, so'ng qaytgan `url`
/// socket orqali yuboriladi. Xatolik xaritalanishi `attendance` ApiImpl
/// bilan bir xil — muvaffaqiyatsizlikda [ServerException] tashlaydi.
class UploadsService {
  UploadsService(this._client);

  final DioClient _client;

  /// [file]ni `POST /uploads` (multipart) orqali yuklaydi. Ovoz/doiraviy
  /// video uchun [durationSec] ham yuboriladi (server metadata sifatida
  /// saqlashi uchun). Muvaffaqiyatda [UploadedMedia] qaytaradi.
  Future<UploadedMedia> upload(File file, {int? durationSec}) async {
    try {
      final segments = file.uri.pathSegments;
      final filename = segments.isEmpty ? 'file' : segments.last;

      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: filename),
        if (durationSec != null) 'durationSec': durationSec,
      });

      final response = await _client.dio.post<Map<String, dynamic>>(
        '/uploads',
        data: formData,
      );
      return UploadedMedia.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      final message = _messageFrom(e.response?.data);
      throw ServerException(message ?? e.message ?? 'Yuklashda xatolik');
    }
  }

  /// Backend xato javobi tanasidan (`{message: "..."}`) matnni ajratadi —
  /// topilmasa `null`.
  String? _messageFrom(Object? data) {
    if (data is Map<String, dynamic>) {
      final message = data['message'];
      if (message is String) return message;
    }
    return null;
  }
}
