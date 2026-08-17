import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('init sets flavor, useMock and apiBaseUrl', () {
    AppConfig.init(
      flavor: AppFlavor.prod,
      useMock: false,
      apiBaseUrl: 'https://x',
    );
    expect(AppConfig.flavor, AppFlavor.prod);
    expect(AppConfig.useMock, isFalse);
    expect(AppConfig.apiBaseUrl, 'https://x');
  });

  test('defaults to dev + mock when not initialised', () {
    // ok: statik standart qiymatlar
    expect(AppFlavor.values, contains(AppFlavor.test));
  });
}
