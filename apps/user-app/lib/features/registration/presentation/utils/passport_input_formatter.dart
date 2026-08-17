import 'package:flutter/services.dart';

/// Pasport seriya+raqami mask'i: 2 ta lotin harfi + 7 ta raqam (masalan
/// `AA1234567`) — `app_ui/src/utils/input_formatters.dart`dagi
/// `DateInputFormatter`/`PhoneUzInputFormatter` bilan bir xil naqsh
/// (`TextInputFormatter` orqali "jonli" formatlash), faqat shu registration
/// xususiyati ichida ishlatilgani uchun mahalliy saqlanadi.
///
/// Harflar avtomatik katta harfga o'tkaziladi. Har bir belgi POZITSION
/// tekshiriladi (birinchi 2 ta o'rin — harf, keyingi 7 ta — raqam);
/// mos kelmagan belgi shunchaki e'tiborga olinmaydi (qayta tartiblanmaydi)
/// — bu klaviaturada "tabiiy" his qiladi.
class PassportInputFormatter extends TextInputFormatter {
  const PassportInputFormatter();

  static const _letterSlots = 2;
  static const _totalLength = 9;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final upper = newValue.text.toUpperCase();
    final buffer = StringBuffer();

    for (var i = 0; i < upper.length && buffer.length < _totalLength; i++) {
      final char = upper[i];
      final expectLetter = buffer.length < _letterSlots;
      final matches = expectLetter
          ? RegExp('[A-Z]').hasMatch(char)
          : RegExp('[0-9]').hasMatch(char);
      if (matches) buffer.write(char);
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
