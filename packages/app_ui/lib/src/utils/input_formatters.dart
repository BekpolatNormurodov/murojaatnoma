import 'package:flutter/services.dart';

/// O'zbekiston mobil raqamining MAHALLIY (local) 9 xonasini
/// `XX XXX XX XX` guruhlarida formatlaydi (masalan `950642827` ->
/// `95 064 28 27`).
///
/// **Muhim**: bu formatter `+998` prefiksini o'ZI hech qachon qo'shmaydi —
/// faqat 9 ta mahalliy raqamni guruhlaydi. Prefiks maydonning tashqarisida,
/// alohida (tahrirlanmaydigan) widget sifatida ko'rsatiladi (qarang:
/// `AppPhoneField`) — shu tufayli foydalanuvchi kursori/tanlovi doim FAQAT
/// haqiqiy kiritiladigan 9 xona ustida ishlaydi, statik prefiks ustida
/// emas. Agar foydalanuvchi raqamni `998` kod bilan joylashtirsa (paste),
/// bu kod avtomatik olib tashlanadi.
class PhoneUzInputFormatter extends TextInputFormatter {
  const PhoneUzInputFormatter();

  static const _maxDigits = 9;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = _digitsOf(newValue.text);
    if (digits.startsWith('998') && digits.length > _maxDigits) {
      digits = digits.substring(3);
    }
    if (digits.length > _maxDigits) {
      digits = digits.substring(0, _maxDigits);
    }

    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      buffer.write(digits[i]);
      final atGroupEnd = i == 1 || i == 4 || i == 6;
      if (atGroupEnd && i != digits.length - 1) {
        buffer.write(' ');
      }
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// Bank kartasi raqami mask'i: `0000 0000 0000 0000` (16 xona, 4talab
/// guruhlangan).
class CardNumberInputFormatter extends TextInputFormatter {
  const CardNumberInputFormatter();

  static const _maxDigits = 16;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = _digitsOf(newValue.text);
    if (digits.length > _maxDigits) {
      digits = digits.substring(0, _maxDigits);
    }

    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      buffer.write(digits[i]);
      if (i % 4 == 3 && i != digits.length - 1) {
        buffer.write(' ');
      }
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// Bank kartasi amal qilish muddati mask'i: `MM/YY` (4 xona, `/` bilan
/// ajratilgan — masalan `0330` -> `03/30`).
///
/// Faqat formatlaydi — oy oralig'ini (`01`-`12`) [isValidMonth] orqali
/// alohida tekshirish kerak.
class CardExpiryInputFormatter extends TextInputFormatter {
  const CardExpiryInputFormatter();

  static const _maxDigits = 4;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = _digitsOf(newValue.text);
    if (digits.length > _maxDigits) {
      digits = digits.substring(0, _maxDigits);
    }

    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      buffer.write(digits[i]);
      if (i == 1 && i != digits.length - 1) {
        buffer.write('/');
      }
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  /// `MM/YY`ning barcha 4 xonasi kiritilganmi.
  static bool isComplete(String value) => _digitsOf(value).length == 4;

  /// Kiritilgan oy (birinchi 2 xona) `01`-`12` oralig'idamI.
  static bool isValidMonth(String value) {
    final digits = _digitsOf(value);
    if (digits.length < 2) return false;
    final month = int.tryParse(digits.substring(0, 2));
    return month != null && month >= 1 && month <= 12;
  }

  /// To'liq va oy jihatidan yaroqli — matn maydoni "amal qiladi"mi
  /// tekshiruvi uchun yagona kirish nuqtasi.
  static bool isValidExpiry(String value) =>
      isComplete(value) && isValidMonth(value);
}

/// Sana mask'i: `DD.MM.YYYY` (8 xona, nuqta bilan ajratilgan).
///
/// Faqat formatlaydi — kun/oy oralig'ini tekshirmaydi (semantik validatsiya
/// chaqiruvchi tomonda).
class DateInputFormatter extends TextInputFormatter {
  const DateInputFormatter();

  static const _maxDigits = 8;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = _digitsOf(newValue.text);
    if (digits.length > _maxDigits) {
      digits = digits.substring(0, _maxDigits);
    }

    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      buffer.write(digits[i]);
      final atGroupEnd = i == 1 || i == 3;
      if (atGroupEnd && i != digits.length - 1) {
        buffer.write('.');
      }
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// Summani (so'm) minglik guruhlarga ajratadi: `1000000` -> `1 000 000`.
///
/// Matn maydonida "jonli" formatlash uchun [TextInputFormatter] sifatida,
/// yoki [format] orqali istalgan joyda (masalan ro'yxat qatorida) sof
/// yordamchi funksiya sifatida ishlatiladi.
class ThousandsAmountFormatter extends TextInputFormatter {
  const ThousandsAmountFormatter({this.maxDigits});

  /// Ruxsat etilgan maksimal xonalar soni (ixtiyoriy — cheklanmagan bo'lishi
  /// mumkin).
  final int? maxDigits;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var digits = _digitsOf(newValue.text);
    if (digits.isEmpty) {
      return TextEditingValue.empty;
    }

    digits = _stripLeadingZeros(digits);
    final limit = maxDigits;
    if (limit != null && digits.length > limit) {
      digits = digits.substring(0, limit);
    }

    final text = formatThousands(digits);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  /// Faqat raqam belgilaridan iborat [digits]ni o'ngdan-chapga 3talab
  /// guruhlab, bo'sh joy bilan ajratadi (masalan `1000000` -> `1 000 000`).
  static String formatThousands(String digits) {
    final reversed = digits.split('').reversed.toList();
    final buffer = StringBuffer();
    for (var i = 0; i < reversed.length; i++) {
      if (i != 0 && i % 3 == 0) {
        buffer.write(' ');
      }
      buffer.write(reversed[i]);
    }
    return buffer.toString().split('').reversed.join();
  }

  /// [amount]ni minglik guruhlangan satrga aylantiradi (manfiy sonlar uchun
  /// old belgi saqlanadi). Masalan `format(1000000)` -> `'1 000 000'`.
  static String format(num amount) {
    final negative = amount < 0;
    final digits = amount.abs().truncate().toString();
    final grouped = formatThousands(digits);
    return negative ? '-$grouped' : grouped;
  }

  static String _stripLeadingZeros(String digits) {
    var i = 0;
    while (i < digits.length - 1 && digits[i] == '0') {
      i++;
    }
    return digits.substring(i);
  }
}

String _digitsOf(String value) => value.replaceAll(RegExp('[^0-9]'), '');
