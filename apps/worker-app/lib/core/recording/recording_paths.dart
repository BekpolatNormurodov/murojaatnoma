import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Yozib olingan ovoz/video biriktirmalar uchun barqaror lokal yo'l
/// quruvchi — `<appDocs>/attachments/<prefix>_<timestampMs>.<ext>`.
class RecordingPaths {
  RecordingPaths._();

  /// Barcha yozib olingan biriktirmalar saqlanadigan quyi jild nomi.
  static const dirName = 'attachments';

  /// Yangi biriktirma uchun to'liq fayl yo'lini qaytaradi, kerak bo'lsa
  /// `attachments/` jildini yaratadi. Faylning o'zi bu yerda YARATILMAYDI
  /// — faqat yozuvchi (`record`/`camera`) keyin yozadigan yo'l hisoblanadi.
  ///
  /// [documentsDirectory] inject qilinadi (standart holatda
  /// `path_provider`ning `getApplicationDocumentsDirectory`si) — shu
  /// tufayli yo'l qurish mantig'i unit-testda vaqtinchalik jild bilan,
  /// platforma-kanalisiz to'liq tekshiriladi (`FacePhotoStoreImpl` bilan
  /// bir xil naqsh — qarang: `face/data/services/face_photo_store.dart`).
  static Future<String> next({
    required String prefix,
    required String extension,
    Future<Directory> Function()? documentsDirectory,
    DateTime? now,
  }) async {
    final resolveDocs = documentsDirectory ?? getApplicationDocumentsDirectory;
    final docs = await resolveDocs();
    final dir = Directory('${docs.path}/$dirName');
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }
    final stamp = (now ?? DateTime.now()).millisecondsSinceEpoch;
    return '${dir.path}/${prefix}_$stamp.$extension';
  }
}
