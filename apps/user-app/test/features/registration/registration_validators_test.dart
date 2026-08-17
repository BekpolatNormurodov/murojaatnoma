import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/registration/presentation/utils/registration_validators.dart';

void main() {
  group('isValidFullName', () {
    test('accepts a two-word name', () {
      expect(isValidFullName('Dilnoza Yusupova'), isTrue);
    });

    test('accepts a three-word name with surrounding whitespace', () {
      expect(isValidFullName('  Aziz Karimov Rustamovich  '), isTrue);
    });

    test('rejects a single word (no surname)', () {
      expect(isValidFullName('Dilnoza'), isFalse);
    });

    test('rejects empty/blank input', () {
      expect(isValidFullName(''), isFalse);
      expect(isValidFullName('   '), isFalse);
    });
  });

  group('isValidPinfl', () {
    test('accepts exactly 14 digits', () {
      expect(isValidPinfl('12345678901234'), isTrue);
    });

    test('rejects fewer than 14 digits', () {
      expect(isValidPinfl('123'), isFalse);
    });

    test('rejects non-digit characters', () {
      expect(isValidPinfl('1234567890123A'), isFalse);
    });

    test('rejects empty input', () {
      expect(isValidPinfl(''), isFalse);
    });
  });

  group('isValidPassport', () {
    test('accepts 2 letters + 7 digits', () {
      expect(isValidPassport('AA1234567'), isTrue);
    });

    test('rejects lowercase letters (formatter uppercases, but the '
        'validator itself must not silently accept raw lowercase)', () {
      expect(isValidPassport('aa1234567'), isFalse);
    });

    test('rejects wrong digit count', () {
      expect(isValidPassport('AA123456'), isFalse);
      expect(isValidPassport('AA12345678'), isFalse);
    });

    test('rejects missing letters', () {
      expect(isValidPassport('121234567'), isFalse);
    });
  });

  group('isValidAddress', () {
    test('accepts a plausible free-text address', () {
      expect(isValidAddress('Chilonzor tumani, 12-uy'), isTrue);
    });

    test('rejects too-short input', () {
      expect(isValidAddress('uy'), isFalse);
    });

    test('rejects whitespace-only input padded to look non-empty', () {
      expect(isValidAddress('      '), isFalse);
    });
  });

  group('parseBirthDate', () {
    test('parses a valid DD.MM.YYYY date', () {
      final result = parseBirthDate('12.05.1995');
      expect(result, DateTime(1995, 5, 12));
    });

    test('accepts a leap-day date (29 Feb on a leap year)', () {
      final result = parseBirthDate('29.02.2000');
      expect(result, DateTime(2000, 2, 29));
    });

    test('rejects a non-existent leap day on a non-leap year', () {
      expect(parseBirthDate('29.02.2001'), isNull);
    });

    test('rejects an impossible day-of-month (31 Feb)', () {
      expect(parseBirthDate('31.02.2020'), isNull);
    });

    test('rejects an out-of-range month', () {
      expect(parseBirthDate('01.13.2020'), isNull);
    });

    test('rejects a malformed string', () {
      expect(parseBirthDate('1995-05-12'), isNull);
      expect(parseBirthDate('12/05/1995'), isNull);
      expect(parseBirthDate(''), isNull);
    });

    test('rejects a future date', () {
      final future = DateTime.now().add(const Duration(days: 3650));
      final text =
          '${future.day.toString().padLeft(2, '0')}.'
          '${future.month.toString().padLeft(2, '0')}.'
          '${future.year}';
      expect(parseBirthDate(text), isNull);
    });

    test('rejects an implausibly old year', () {
      expect(parseBirthDate('01.01.1800'), isNull);
    });

    test('accepts today as a valid (edge-case) birth date', () {
      final today = DateTime.now();
      final todayDateOnly = DateTime(today.year, today.month, today.day);
      final text =
          '${today.day.toString().padLeft(2, '0')}.'
          '${today.month.toString().padLeft(2, '0')}.'
          '${today.year}';
      expect(parseBirthDate(text), todayDateOnly);
    });
  });
}
