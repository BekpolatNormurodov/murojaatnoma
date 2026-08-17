import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';

/// `FaceTemplate` uchun lokal, shifrlangan saqlash manbai.
abstract class FaceLocalDataSource {
  /// Saqlangan shablonni o'qiydi; hali ro'yxatdan o'tilmagan bo'lsa
  /// `null` qaytaradi.
  Future<FaceTemplate?> read();

  /// Shablonni shifrlangan xotiraga yozadi (mavjud bo'lsa, almashtiradi).
  Future<void> write(FaceTemplate template);
}

/// `FlutterSecureStorage` (platform keychain/keystore) orqali ishlaydigan
/// implementatsiya. Har qanday platform-kanal xatoligi (yoki buzilgan
/// JSON) `CacheException`ga o'raladi — chaqiruvchi (`FaceRepositoryImpl`)
/// buni tegishli `Failure`ga aylantiradi.
class FaceLocalDataSourceImpl implements FaceLocalDataSource {
  FaceLocalDataSourceImpl(this._storage);

  final FlutterSecureStorage _storage;

  /// Yuz shabloni JSON'i shu kalit ostida saqlanadi.
  static const _templateKey = 'face_template';

  @override
  Future<FaceTemplate?> read() async {
    try {
      final raw = await _storage.read(key: _templateKey);
      if (raw == null) return null;

      // `FaceTemplate.fromJson`ning ichki `as` cast'lari `TypeError`
      // (`Error`, `Exception` emas) tashlaydi agar saqlangan JSON
      // sintaktik jihatdan to'g'ri, lekin shakli noto'g'ri bo'lsa (masalan,
      // boshqa versiyadan qolgan yozuv). `very_good_analysis` `Error`
      // ushlashni taqiqlaydi (`avoid_catching_errors`), shuning uchun
      // `fromJson`ga faqat tekshirilgan, to'g'ri shakldagi map beriladi —
      // aks holda shu yerda nazoratli `CacheException` tashlanadi.
      final decoded = json.decode(raw);
      if (decoded is! Map<String, dynamic>) {
        throw CacheException('Saqlangan yuz shabloni JSON shakli buzilgan');
      }
      final embedding = decoded['embedding'];
      if (embedding is! List ||
          !embedding.every((e) => e is num) ||
          decoded['enrolled_at'] is! String ||
          decoded['worker_id'] is! String) {
        throw CacheException('Saqlangan yuz shabloni maydonlari buzilgan');
      }
      return FaceTemplate.fromJson(decoded);
    } on CacheException {
      // Yuqoridagi tekshiruvlardan kelgan — o'zgarishsiz uzatiladi (aks
      // holda pastdagi umumiy `on Exception` uni qayta o'rab,
      // `e.toString()` orqali xabarni yo'qotib qo'yardi — `CacheException`
      // maxsus `toString()`ga ega emas).
      rethrow;
    } on Exception catch (e) {
      throw CacheException(e.toString());
    }
  }

  @override
  Future<void> write(FaceTemplate template) async {
    try {
      await _storage.write(
        key: _templateKey,
        value: json.encode(template.toJson()),
      );
    } on Exception catch (e) {
      throw CacheException(e.toString());
    }
  }
}
