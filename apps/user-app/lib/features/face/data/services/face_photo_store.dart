import 'dart:io';
import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';

/// Ro'yxatdan o'tkazish (enrollment) paytida skanerlangan yuz kadrini
/// profil avatari sifatida ko'rsatish uchun lokal (ilova-hujjatlari)
/// xotirasiga JPG ko'rinishida saqlaydigan xizmat.
///
/// Rasm — BEST-EFFORT: har qanday fayl I/O yoki kodlash xatosi jim
/// yutiladi (`null` qaytariladi), shuning uchun rasm saqlanmasa ham
/// ro'yxatdan o'tkazish HECH QACHON uzilmaydi. Piksel-yozish yo'li
/// qurilma-only (real kadr baytlari kerak) — `FaceEmbedder` bilan bir xil
/// pretsedent.
abstract class FacePhotoStore {
  /// Kesilgan yuzning xom RGB baytlaridan (`size`×`size`×3, ML Kit
  /// pipeline'idagi `rgb112` bilan bir xil format) JPG yasab,
  /// `<appDocs>/face/enrolled.jpg` fayliga yozadi. Muvaffaqiyatda fayl
  /// yo'lini, xatoda `null` qaytaradi (best-effort).
  Future<String?> saveRgb(Uint8List rgbBytes, {required int size});

  /// Saqlangan yuz-rasm yo'li — fayl mavjud bo'lsa, aks holda `null`
  /// (profil sarlavhasi shunda initsial-avatarga qaytadi).
  Future<String?> currentPath();
}

/// `path_provider` + `dart:io` orqali ishlaydigan implementatsiya.
///
/// `documentsDirectory` konstruktor orqali inject qilinadi (standart
/// holatda `path_provider`ning `getApplicationDocumentsDirectory`si) —
/// shu tufayli fayl I/O + JPG kodlash unit-testda vaqtinchalik jild bilan,
/// platforma-kanalisiz to'liq tekshiriladi.
class FacePhotoStoreImpl implements FacePhotoStore {
  FacePhotoStoreImpl({Future<Directory> Function()? documentsDirectory})
    : _documentsDirectory =
          documentsDirectory ?? getApplicationDocumentsDirectory;

  final Future<Directory> Function() _documentsDirectory;

  static const _dirName = 'face';
  static const _fileName = 'enrolled.jpg';

  Future<File> _target() async {
    final docs = await _documentsDirectory();
    final dir = Directory('${docs.path}/$_dirName');
    if (!dir.existsSync()) {
      dir.createSync(recursive: true);
    }
    return File('${dir.path}/$_fileName');
  }

  @override
  Future<String?> saveRgb(Uint8List rgbBytes, {required int size}) async {
    try {
      if (size <= 0 || rgbBytes.length < size * size * 3) return null;

      final image = img.Image(width: size, height: size);
      var i = 0;
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          image.setPixelRgb(
            x,
            y,
            rgbBytes[i],
            rgbBytes[i + 1],
            rgbBytes[i + 2],
          );
          i += 3;
        }
      }

      final file = await _target();
      await file.writeAsBytes(img.encodeJpg(image, quality: 85), flush: true);
      return file.path;
    } on Object {
      // Best-effort — rasm ixtiyoriy; saqlash muvaffaqiyatsiz bo'lsa ham
      // ro'yxatdan o'tkazish davom etadi.
      return null;
    }
  }

  @override
  Future<String?> currentPath() async {
    try {
      final file = await _target();
      return file.existsSync() ? file.path : null;
    } on Object {
      return null;
    }
  }
}
