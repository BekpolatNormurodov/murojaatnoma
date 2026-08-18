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

      // `full_name` — YAGONA har doim majburiy maydon.
      if (decoded['full_name'] is! String) {
        throw CacheException('Saqlangan fuqaro profili maydonlari buzilgan');
      }

      // `document_type`/`document_number` — IXTIYORIY, lekin JUFT: ikkalasi
      // ham mavjud (va to'g'ri shaklda) YOKI ikkalasi ham yo'q bo'lishi
      // kerak — biri bo'lib ikkinchisi bo'lmasa (yoki `document_type`
      // tanish bo'lmagan qiymat bo'lsa), bu YARIM-buzilgan holat.
      final rawDocumentType = decoded['document_type'];
      final rawDocumentNumber = decoded['document_number'];
      final hasDocumentType = rawDocumentType != null;
      if (hasDocumentType != (rawDocumentNumber != null)) {
        throw CacheException('Saqlangan fuqaro profili maydonlari buzilgan');
      }
      if (hasDocumentType) {
        if (rawDocumentType is! String || rawDocumentNumber is! String) {
          throw CacheException(
            'Saqlangan fuqaro profili maydonlari buzilgan',
          );
        }
        if (!DocumentType.values.any((v) => v.name == rawDocumentType)) {
          throw CacheException(
            'Saqlangan fuqaro profili maydonlari buzilgan',
          );
        }
      }

      // `birth_date`/`region_code`/`district_code`/`address` — mustaqil
      // IXTIYORIY maydonlar: mavjud bo'lsa String bo'lishi shart, yo'q
      // (yoki JSON `null`) bo'lsa — "kiritilmagan" deb talqin qilinadi.
      const optionalStringFields = [
        'birth_date',
        'region_code',
        'district_code',
        'address',
      ];
      for (final field in optionalStringFields) {
        final value = decoded[field];
        if (value != null && value is! String) {
          throw CacheException(
            'Saqlangan fuqaro profili maydonlari buzilgan',
          );
        }
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
