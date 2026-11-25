import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:user_app/core/session/account_data_store.dart';

/// Noto'g'ri PIN urinishlari soni — ilova qayta ishga tushsa ham saqlanadi.
class PinAttemptStore {
  PinAttemptStore(this._storage);

  final FlutterSecureStorage _storage;

  Future<int> read() async {
    try {
      final raw = await _storage.read(key: AccountDataStore.pinAttemptsKey);
      return int.tryParse(raw ?? '') ?? 0;
    } on Exception {
      return 0;
    }
  }

  Future<void> write(int attempts) async {
    try {
      await _storage.write(
        key: AccountDataStore.pinAttemptsKey,
        value: '$attempts',
      );
    } on Exception {
      // Hisoblagich yozilmasa ham xotiradagi hisob ishlaydi.
    }
  }
}
