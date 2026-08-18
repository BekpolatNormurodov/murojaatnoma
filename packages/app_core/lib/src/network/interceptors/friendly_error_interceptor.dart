import 'package:dio/dio.dart';

/// Dio xatolarini foydalanuvchiga ko'rinadigan TOZA, tushunarli o'zbekcha
/// xabarga aylantiradi.
///
/// Muammo: `DioException.message` xom framework matnini olib yuradi (masalan
/// "...status code of 502 ... RequestOptions.validateStatus..."), va ko'p
/// data source'lar uni `ServerException(e.message)` orqali to'g'ridan-to'g'ri
/// ekranga chiqaradi.
///
/// Yechim: barcha xatolar shu interceptor orqali o'tadi, shuning uchun uni
/// BIR MARTA (markazda) toza matnga almashtiramiz. Ro'yxat OXIRIDA qo'shiladi
/// — `LoggingInterceptor` xom xatoni loglab bo'lgach ishlaydi, shu bois debug
/// loglar batafsil qoladi, foydalanuvchi esa faqat toza xabarni ko'radi.
class FriendlyErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    handler.next(err.copyWith(message: _friendlyMessage(err)));
  }

  String _friendlyMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return 'Server javob bermadi. Internet aloqangizni tekshiring.';
      case DioExceptionType.connectionError:
        return "Internetga ulanib bo'lmadi. Aloqani tekshirib, qayta urining.";
      case DioExceptionType.badCertificate:
        return 'Xavfsiz ulanishda muammo yuz berdi.';
      case DioExceptionType.cancel:
        return "So'rov bekor qilindi.";
      case DioExceptionType.badResponse:
        // Backend toza `{message}` (o'zbekcha) qaytargan bo'lsa — o'shani
        // ishlatamiz; aks holda status kodiga qarab umumiy xabar beramiz.
        final serverMessage = _serverMessage(e.response?.data);
        if (serverMessage != null) return serverMessage;
        final status = e.response?.statusCode ?? 0;
        if (status == 401 || status == 403) {
          return "Ruxsat yo'q yoki sessiya tugagan. Iltimos qayta kiring.";
        }
        if (status == 404) return "Ma'lumot topilmadi.";
        if (status == 429) {
          return "Juda ko'p so'rov yuborildi. Birozdan so'ng urining.";
        }
        if (status >= 500) {
          return "Server vaqtincha ishlamayapti. Birozdan so'ng urining.";
        }
        return "So'rovni bajarib bo'lmadi. Qayta urinib ko'ring.";
      case DioExceptionType.unknown:
        return "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.";
    }
  }

  /// Backend javobidagi toza `message` matnini ajratib oladi (bo'lsa). NestJS
  /// odatda `{ "message": "..." }` yoki `{ "message": ["...", "..."] }` beradi.
  String? _serverMessage(Object? data) {
    if (data is! Map) return null;
    final message = data['message'];
    if (message is String) {
      final trimmed = message.trim();
      if (trimmed.isNotEmpty && trimmed.length <= 200) return trimmed;
    }
    if (message is List && message.isNotEmpty) {
      final parts = message.whereType<String>().toList();
      if (parts.isNotEmpty) return parts.join(', ');
    }
    return null;
  }
}
