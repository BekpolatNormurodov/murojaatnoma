/// Data qatlamida (masalan, `datasource`/`repository`) uloqtiriladigan
/// past darajali xatoliklar. Bular repository qatlamida tegishli
/// `Failure` turlariga aylantiriladi.
class ServerException implements Exception {
  ServerException([this.message = 'Server xatosi']);

  /// Xatolik haqida foydalanuvchiga ko'rsatsa bo'ladigan matn.
  final String message;
}

class AuthException implements Exception {
  AuthException([this.message = 'Avtorizatsiya xatosi']);

  final String message;
}

class CacheException implements Exception {
  CacheException([this.message = 'Keshda xato']);

  final String message;
}

class NetworkException implements Exception {
  NetworkException([this.message = 'Tarmoq xatosi']);

  final String message;
}
