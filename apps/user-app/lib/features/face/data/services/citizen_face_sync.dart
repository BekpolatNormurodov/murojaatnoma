import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

/// Fuqaroning yuzini serverga (`/applications/face`) bir marta saqlaydi —
/// keyin har bir murojaat shu yuz bilan yuboriladi va xodim/admin "kim
/// yozgan"ini ko'radi. Server faqat shu telefon egasining o'z tokeni bilan
/// yuklangan yuzni murojaatga bog'laydi (boshqa birovniki o'tmaydi).
///
/// Hammasi BEST-EFFORT: internet bo'lmasa ro'yxatdan o'tish ham, murojaat
/// yuborish ham to'xtamaydi — keyingi murojaatda yana urinadi.
class CitizenFaceSync {
  CitizenFaceSync(
    this._client, {
    Future<Directory> Function()? documentsDirectory,
    this.timeout = const Duration(seconds: 8),
  }) : _documentsDirectory =
           documentsDirectory ?? getApplicationDocumentsDirectory;

  final DioClient _client;
  final Future<Directory> Function() _documentsDirectory;
  final Duration timeout;
  String? _url;

  Future<File> _portrait() async {
    final docs = await _documentsDirectory();
    return File('${docs.path}/face/portrait.jpg');
  }

  Future<File> _enrolled() async {
    final docs = await _documentsDirectory();
    return File('${docs.path}/face/enrolled.jpg');
  }

  /// Ro'yxatdan o'tishdagi yuz portretini saqlab, darhol yuklaydi (yangi
  /// yuz eskisining o'rnini egallaydi).
  Future<void> saveAndUpload(Uint8List jpg) async {
    try {
      final file = await _portrait();
      await file.parent.create(recursive: true);
      await file.writeAsBytes(jpg, flush: true);
      _url = null;
      await _upload(file);
    } on Object {
      // keyingi murojaatda qayta urinadi
    }
  }

  /// Murojaat yuborishdan oldin: serverdagi yuz URL'i (bo'lmasa lokal
  /// rasmni yuklab). Hech narsa bo'lmasa `null`.
  Future<String?> ensureUploaded() async {
    if (_url != null) return _url;
    try {
      final res = await _client.dio
          .get<Map<String, dynamic>>('/applications/face')
          .timeout(timeout);
      final url = res.data?['photoUrl'];
      if (url is String && url.isNotEmpty) return _url = url;
    } on Object {
      // pastda lokal rasmdan urinamiz
    }
    for (final file in [await _portrait(), await _enrolled()]) {
      if (file.existsSync()) return _upload(file);
    }
    return null;
  }

  Future<String?> _upload(File file) async {
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: 'face.jpg',
          contentType: DioMediaType('image', 'jpeg'),
        ),
      });
      final res = await _client.dio
          .post<Map<String, dynamic>>('/applications/face', data: form)
          .timeout(timeout);
      final url = res.data?['photoUrl'];
      return url is String && url.isNotEmpty ? _url = url : null;
    } on Object {
      return null;
    }
  }
}
