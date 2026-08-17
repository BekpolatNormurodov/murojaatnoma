import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';

/// `CitizenProfile` uchun lokal, shifrlangan saqlash manbai.
///
/// `FaceLocalDataSourceImpl` bilan bir xil naqsh (bitta JSON hujjat, `null`
/// == hali ro'yxatdan o'tilmagan).
abstract class RegistrationLocalDataSource {
  /// Saqlangan profilni o'qiydi; hali ro'yxatdan o'tilmagan bo'lsa `null`
  /// qaytaradi.
  Future<CitizenProfile?> read();

  /// Profilni shifrlangan xotiraga yozadi (mavjud bo'lsa, almashtiradi).
  Future<void> write(CitizenProfile profile);
}

/// `FlutterSecureStorage` (platform keychain/keystore) orqali ishlaydigan
/// implementatsiya — `FaceLocalDataSourceImpl`dagi bir xil himoyalangan
/// dekodlash uslubi bilan.
class RegistrationLocalDataSourceImpl implements RegistrationLocalDataSource {
  RegistrationLocalDataSourceImpl(this._storage);

  final FlutterSecureStorage _storage;

  /// Fuqaro profili JSON'i shu kalit ostida saqlanadi.
  static const _profileKey = 'citizen_profile';

  @override
  Future<CitizenProfile?> read() async {
    try {
      final raw = await _storage.read(key: _profileKey);
      if (raw == null) return null;

      // `CitizenProfile.fromJson`ning ichki `as` cast'lari `TypeError`
      // (`Error`, `Exception` emas) tashlaydi agar saqlangan JSON
      // sintaktik jihatdan to'g'ri, lekin shakli noto'g'ri bo'lsa.
      // `very_good_analysis` `Error` ushlashni taqiqlaydi
      // (`avoid_catching_errors`), shuning uchun `fromJson`ga faqat
      // tekshirilgan, to'g'ri shakldagi map beriladi — aks holda shu yerda
      // nazoratli `CacheException` tashlanadi (`FaceLocalDataSourceImpl`
      // bilan bir xil himoya).
      final decoded = json.decode(raw);
      if (decoded is! Map<String, dynamic>) {
        throw CacheException('Saqlangan fuqaro profili JSON shakli buzilgan');
      }
      final requiredStringFields = [
        'full_name',
        'document_type',
        'document_number',
        'birth_date',
        'region_code',
        'district_code',
        'address',
      ];
      for (final field in requiredStringFields) {
        if (decoded[field] is! String) {
          throw CacheException(
            'Saqlangan fuqaro profili maydonlari buzilgan',
          );
        }
      }
      if (!DocumentType.values.any(
        (v) => v.name == decoded['document_type'],
      )) {
        throw CacheException('Saqlangan fuqaro profili maydonlari buzilgan');
      }
      return CitizenProfile.fromJson(decoded);
    } on CacheException {
      rethrow;
    } on Exception catch (e) {
      throw CacheException(e.toString());
    }
  }

  @override
  Future<void> write(CitizenProfile profile) async {
    try {
      await _storage.write(
        key: _profileKey,
        value: json.encode(profile.toJson()),
      );
    } on Exception catch (e) {
      throw CacheException(e.toString());
    }
  }
}
