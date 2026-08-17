import 'package:app_core/app_core.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// PIN xeshi uchun lokal, shifrlangan saqlash manbai.
///
/// `FaceLocalDataSourceImpl` bilan bir xil naqsh — faqat bitta satr
/// (xesh) saqlaydi, JSON serializatsiya kerak emas.
abstract class PinLocalDataSource {
  /// Saqlangan PIN xeshini o'qiydi; hali o'rnatilmagan bo'lsa `null`.
  Future<String?> readHash();

  /// PIN xeshini shifrlangan xotiraga yozadi (mavjud bo'lsa, almashtiradi).
  Future<void> writeHash(String hash);
}

/// `FlutterSecureStorage` (platform keychain/keystore) orqali ishlaydigan
/// implementatsiya.
class PinLocalDataSourceImpl implements PinLocalDataSource {
  PinLocalDataSourceImpl(this._storage);

  final FlutterSecureStorage _storage;

  /// PIN xeshi shu kalit ostida saqlanadi.
  static const _pinHashKey = 'pin_hash';

  @override
  Future<String?> readHash() async {
    try {
      return await _storage.read(key: _pinHashKey);
    } on Exception catch (e) {
      throw CacheException(e.toString());
    }
  }

  @override
  Future<void> writeHash(String hash) async {
    try {
      await _storage.write(key: _pinHashKey, value: hash);
    } on Exception catch (e) {
      throw CacheException(e.toString());
    }
  }
}
