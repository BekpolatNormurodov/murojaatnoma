import 'dart:convert';

import 'package:crypto/crypto.dart';

/// PIN kodni doimiy xotiraga yozishdan OLDIN SHA-256 bilan xeshlaydi —
/// xom (plaintext) PIN hech qachon diskka yozilmaydi (xavfsizlik talabi).
///
/// Sof, holatsiz (stateless) yordamchi — `FaceMatcher` (`worker_app`)
/// bilan bir xil naqsh: repository uni to'g'ridan-to'g'ri `const
/// PinHasher().hash(...)` sifatida chaqiradi, DI orqali inject qilinmaydi.
class PinHasher {
  const PinHasher();

  /// Xeshlashdan oldin PINga qo'shiladigan doimiy ilova "salt"i. Maxfiy
  /// kalit EMAS (kodga qattiq yozilgan) — faqat xom SHA-256 lug'at
  /// jadvallariga (rainbow table) qarshi oddiy to'siq; haqiqiy xavfsizlik
  /// qurilmaning xavfsiz xotirasiga (Keychain/Keystore) tayanadi.
  static const _salt = 'hokimiyat.user-app.pin.v1';

  /// `[pin] + doimiy salt`ning UTF-8 baytlari SHA-256 xesh-yig'indisini
  /// o'n oltilik (hex) satr sifatida qaytaradi.
  String hash(String pin) =>
      sha256.convert(utf8.encode('$pin$_salt')).toString();
}
