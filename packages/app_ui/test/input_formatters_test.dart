import 'package:app_ui/app_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// [formatter] orqali [text]ni "bo'sh qiymatdan bitta muharrirlashda
/// kiritilgandek" formatlaydi — mask formatter'larni test qilish uchun
/// yordamchi.
TextEditingValue _apply(TextInputFormatter formatter, String text) {
  return formatter.formatEditUpdate(
    TextEditingValue.empty,
    TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    ),
  );
}

void main() {
  group('PhoneUzInputFormatter', () {
    const formatter = PhoneUzInputFormatter();

    test('formats 9 raw digits into XX XXX XX XX (no +998 prefix)', () {
      final result = _apply(formatter, '901234567');
      expect(result.text, '90 123 45 67');
      expect(result.selection.baseOffset, result.text.length);
    });

    test('strips a leading 998 country code if the full number is pasted', () {
      final result = _apply(formatter, '998901234567');
      expect(result.text, '90 123 45 67');
    });

    test(
      'does NOT strip a 998-looking prefix when exactly 9 digits are '
      'typed (a real local number may start with operator code 99)',
      () {
        final result = _apply(formatter, '998123456');
        expect(result.text, '99 812 34 56');
      },
    );

    test('ignores non-digit characters and truncates beyond 9 digits', () {
      final result = _apply(formatter, '90-123-45-67-99');
      expect(result.text, '90 123 45 67');
    });

    test('formats partial input progressively', () {
      expect(_apply(formatter, '9').text, '9');
      expect(_apply(formatter, '90').text, '90');
      expect(_apply(formatter, '901').text, '90 1');
    });
  });

  group('CardNumberInputFormatter', () {
    const formatter = CardNumberInputFormatter();

    test('groups 16 digits into 4-digit blocks', () {
      final result = _apply(formatter, '1234567890123456');
      expect(result.text, '1234 5678 9012 3456');
    });

    test('truncates beyond 16 digits', () {
      final result = _apply(formatter, '12345678901234567890');
      expect(result.text, '1234 5678 9012 3456');
    });

    test('strips non-digit paste artifacts', () {
      final result = _apply(formatter, '1234 5678 9012 3456');
      expect(result.text, '1234 5678 9012 3456');
    });
  });

  group('DateInputFormatter', () {
    const formatter = DateInputFormatter();

    test('formats 8 digits into DD.MM.YYYY', () {
      final result = _apply(formatter, '24072026');
      expect(result.text, '24.07.2026');
    });

    test('formats partial input without a dangling trailing dot', () {
      expect(_apply(formatter, '2').text, '2');
      expect(_apply(formatter, '24').text, '24');
      expect(_apply(formatter, '240').text, '24.0');
      expect(_apply(formatter, '2407').text, '24.07');
    });

    test('truncates beyond 8 digits', () {
      final result = _apply(formatter, '240720261234');
      expect(result.text, '24.07.2026');
    });
  });

  group('ThousandsAmountFormatter', () {
    const formatter = ThousandsAmountFormatter();

    test('formatThousands groups from the right in 3s', () {
      expect(ThousandsAmountFormatter.formatThousands('1000000'), '1 000 000');
      expect(ThousandsAmountFormatter.formatThousands('12345'), '12 345');
      expect(ThousandsAmountFormatter.formatThousands('999'), '999');
      expect(ThousandsAmountFormatter.formatThousands('0'), '0');
    });

    test('format() renders a num amount with grouping', () {
      expect(ThousandsAmountFormatter.format(1000000), '1 000 000');
      expect(ThousandsAmountFormatter.format(500), '500');
      expect(ThousandsAmountFormatter.format(-25000), '-25 000');
    });

    test('formatEditUpdate groups live-typed digits', () {
      final result = _apply(formatter, '1000000');
      expect(result.text, '1 000 000');
    });

    test('strips leading zeros while typing', () {
      final result = _apply(formatter, '00500');
      expect(result.text, '500');
    });

    test('empty input clears the field', () {
      final result = _apply(formatter, '');
      expect(result.text, '');
    });

    test('respects an optional maxDigits cap', () {
      const capped = ThousandsAmountFormatter(maxDigits: 4);
      final result = _apply(capped, '1234567');
      expect(result.text, '1 234');
    });
  });
}
