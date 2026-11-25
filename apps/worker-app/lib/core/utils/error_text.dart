import 'package:flutter/foundation.dart';

/// Kutilmagan istisno uchun foydalanuvchiga ko'rsatiladigan matn. Xom
/// (inglizcha/texnik) xato faqat logga yoziladi.
String unexpectedError(Object error) {
  debugPrint('[worker] unexpected error: $error');
  return "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring";
}
