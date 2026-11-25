/// Android bir vaqtda faqat BITTA ruxsat so'rovini qabul qiladi: boshqasi
/// ochiq turganda yuborilgan so'rov bo'sh javob oladi (geolocator bunda
/// Dart future'ini umuman yakunlamaydi) yoki xato tashlaydi. Ilova ochilishida
/// o'z-o'zidan chiqadigan so'rovlar (bildirishnoma, joylashuv) shu navbat
/// orqali ketma-ket yuboriladi.
Future<T> queuedPermissionRequest<T>(Future<T> Function() request) {
  final result = _tail.then((_) => request());
  // Javobsiz qolgan so'rov navbatni abadiy to'sib qo'ymasin.
  _tail = result
      .then<void>((_) {})
      .timeout(permissionRequestTimeout)
      .catchError((Object _) {});
  return result;
}

/// Bitta ruxsat oynasiga beriladigan eng ko'p kutish vaqti.
const Duration permissionRequestTimeout = Duration(minutes: 2);

Future<void> _tail = Future<void>.value();
