enum AppFlavor { dev, test, prod }

/// Butun app uchun runtime konfiguratsiya. `main_*.dart` da init qilinadi.
class AppConfig {
  AppConfig._();
  static AppFlavor flavor = AppFlavor.dev;
  static bool useMock = true;
  static String apiBaseUrl = 'https://api.hokimiyat.uz/v1';

  static void init({
    required AppFlavor flavor,
    required bool useMock,
    String? apiBaseUrl,
  }) {
    AppConfig.flavor = flavor;
    AppConfig.useMock = useMock;
    if (apiBaseUrl != null) AppConfig.apiBaseUrl = apiBaseUrl;
  }
}
