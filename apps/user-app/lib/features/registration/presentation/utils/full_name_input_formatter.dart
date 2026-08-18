import 'package:flutter/services.dart';

/// F.I.Sh. maydoni uchun "jonli" (yozayotganda) katta-kichik harflarni
/// TO'G'RILAB boruvchi formatter — `PassportInputFormatter`/`app_ui`dagi
/// `DateInputFormatter` bilan bir xil naqsh.
///
/// Har bir SO'Z boshidagi harf katta, qolgani kichik harfga aylantiriladi
/// (masalan `aliyev BEKZOD` -> `Aliyev Bekzod`) — foydalanuvchi
/// CAPS LOCK yoqiq holda yoki hammasi kichik harfda kiritsa ham, ism
/// har doim TO'G'RI, tushunarli formatda ko'rinadi (registratsiya
/// formasidagi "ism/familiyani aniq va to'g'ri kiritish" talabi).
///
/// Belgi-belgiga o'zgartiriladi (uzunlik o'zgarmaydi), shuning uchun
/// kursor pozitsiyasi har doim to'g'ri saqlanadi — bo'sh joy so'z
/// chegarasi sifatida ishlatiladi, boshqa belgilar (apostrof `'`/`’`
/// kabi — o'zbekcha "oʻ"/"gʻ" harflari uchun) so'zni UZMAYDI (masalan
/// `yoʻldosh` -> `Yoʻldosh`, o'rtadagi apostrofdan keyin qayta bosh
/// harfga aylanmaydi).
class FullNameInputFormatter extends TextInputFormatter {
  const FullNameInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = newValue.text;
    if (text.isEmpty) return newValue;

    final buffer = StringBuffer();
    var capitalizeNext = true;
    for (var i = 0; i < text.length; i++) {
      final char = text[i];
      if (char == ' ') {
        buffer.write(char);
        capitalizeNext = true;
        continue;
      }
      buffer.write(capitalizeNext ? char.toUpperCase() : char.toLowerCase());
      capitalizeNext = false;
    }

    return newValue.copyWith(text: buffer.toString());
  }
}
