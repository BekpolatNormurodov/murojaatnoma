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

/// Yuklash xatosi — HTTP status bilan (qayta urinish ma'nolimi aniqlash uchun).
class UploadException extends ServerException {
  UploadException(super.message, {this.statusCode});

  final int? statusCode;

  /// Qayta yuborish foydasiz (fayl turi/hajmi yaroqsiz).
  bool get isPermanent => const {400, 413, 415, 422}.contains(statusCode);
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
  ///
  /// [onProgress] — 0..1 yuklash ulushi (masalan biriktirma tile'ida
  /// progress ko'rsatish uchun).
  Future<UploadedMedia> upload(
    File file, {
    int? durationSec,
    void Function(double progress)? onProgress,
  }) => _post(
    '/uploads',
    file,
    durationSec: durationSec,
    onProgress: onProgress,
  );

  /// Hujjatni (pdf/doc/docx/xls/xlsx/ppt/pptx/txt/csv/rtf/odt/ods/zip —
  /// shuningdek rasm/video/audio) `POST /uploads/document` orqali yuklaydi
  /// (≤25 MB). Muvaffaqiyatda [UploadedMedia] qaytaradi.
  Future<UploadedMedia> uploadDocument(
    File file, {
    void Function(double progress)? onProgress,
  }) => _post('/uploads/document', file, onProgress: onProgress);

  Future<UploadedMedia> _post(
    String endpoint,
    File file, {
    int? durationSec,
    void Function(double progress)? onProgress,
  }) async {
    try {
      final segments = file.uri.pathSegments;
      final filename = segments.isEmpty ? 'file' : segments.last;

      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: filename),
        if (durationSec != null) 'durationSec': durationSec,
      });

      final response = await _client.dio.post<Map<String, dynamic>>(
        endpoint,
        data: formData,
        options: _uploadOptions(await file.length()),
        onSendProgress: onProgress == null
            ? null
            : (sent, total) {
                if (total > 0) onProgress((sent / total).clamp(0, 1));
              },
      );
      return UploadedMedia.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      final message = _messageFrom(e.response?.data);
      throw UploadException(
        message ?? e.message ?? 'Yuklashda xatolik',
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// `sendTimeout` butun tanani yuborishni cheklaydi: sekin mobil internetda
  /// 20 MB video 90 soniyaga sig'maydi. Katta faylni boshidan qayta-qayta
  /// yubormaymiz (foydalanuvchida "qayta yuklash" tugmasi bor).
  static Options _uploadOptions(int bytes) => Options(
    sendTimeout: const Duration(minutes: 10),
    receiveTimeout: const Duration(minutes: 2),
    extra: bytes > largeFileBytes ? <String, dynamic>{'noRetry': true} : null,
  );

  static const int largeFileBytes = 5 * 1024 * 1024;

  /// Backend xato javobi tanasidan (`{message: "..."}`) matnni ajratadi —
  /// topilmasa `null`.
  String? _messageFrom(Object? data) {
    if (data is Map<String, dynamic>) {
      final message = data['message'];
      if (message is String) return message;
      // NestJS validatsiya xatolari: `{message: ["...", "..."]}`.
      if (message is List && message.isNotEmpty) {
        return message.whereType<String>().join(', ');
      }
    }
    return null;
  }
}
