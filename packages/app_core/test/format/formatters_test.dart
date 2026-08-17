import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test("formatSom groups thousands with so'm suffix", () {
    expect(formatSom(1234567), "1 234 567 so'm");
  });
  test('formatDate renders Uzbek short month', () {
    expect(formatDate(DateTime(2026, 6, 12)), '12 Iyn 2026');
  });
}
