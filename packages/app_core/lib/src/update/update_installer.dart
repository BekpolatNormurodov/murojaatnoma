import 'dart:io';

import 'package:app_core/src/update/app_update.dart';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

/// Yuklangan fayl manifestdagi bilan bir xil emas.
class DamagedUpdate implements Exception {
  const DamagedUpdate();
}

/// APK'ni qurilmaga yuklab, tizim o'rnatuvchisiga beradi.
class UpdateInstaller {
  UpdateInstaller({
    Dio? dio,
    Future<Directory> Function()? directory,
    Future<bool> Function(String path)? open,
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 20),
               // Ikki bo'lak orasidagi sukunat chegarasi, umumiy vaqt emas.
               receiveTimeout: const Duration(seconds: 60),
             ),
           ),
       _directory = directory ?? getTemporaryDirectory,
       _open = open ?? _openApk;

  final Dio _dio;
  final Future<Directory> Function() _directory;
  final Future<bool> Function(String path) _open;

  static Future<bool> _openApk(String path) async {
    final result = await OpenFilex.open(
      path,
      type: 'application/vnd.android.package-archive',
    );
    return result.type == ResultType.done;
  }

  /// Yuklab, tekshirib, fayl yo'lini qaytaradi. Oldin to'liq yuklangan fayl
  /// qayta yuklanmaydi; eski versiyalar o'chiriladi. [onProgress] — 0..1.
  Future<File> download(
    AppRelease release, {
    void Function(double progress)? onProgress,
    CancelToken? cancel,
  }) async {
    final folder = Directory('${(await _directory()).path}/updates');
    final file = File('${folder.path}/update-${release.build}.apk');
    if (file.existsSync()) {
      if (await _intact(file, release)) {
        onProgress?.call(1);
        return file;
      }
      await file.delete();
    }
    if (folder.existsSync()) await folder.delete(recursive: true);
    await folder.create(recursive: true);

    final part = File('${file.path}.part');
    await _dio.downloadUri(
      release.url,
      part.path,
      cancelToken: cancel,
      onReceiveProgress: (received, total) {
        final size = total > 0 ? total : release.size;
        if (size > 0) onProgress?.call((received / size).clamp(0, 1));
      },
    );
    if (!await _intact(part, release)) {
      await part.delete();
      throw const DamagedUpdate();
    }
    return part.rename(file.path);
  }

  /// Tizim o'rnatish oynasini ochadi; ochib bo'lmasa `false`.
  Future<bool> install(File file) => _open(file.path);

  static Future<bool> _intact(File file, AppRelease release) async {
    if (release.size > 0 && await file.length() != release.size) return false;
    final expected = release.sha256;
    if (expected == null) return true;
    return (await sha256.bind(file.openRead()).first).toString() == expected;
  }
}
