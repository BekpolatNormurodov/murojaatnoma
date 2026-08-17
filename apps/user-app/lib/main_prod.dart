import 'package:app_core/app_core.dart';
import 'package:user_app/main.dart' as bootstrap;

/// Prod flavor entrypoint.
///
/// `apiBaseUrl` doim jonli MUROJAAT backendiga (`https://murojaatnoma.uz
/// /api`) ishora qiladi — Auth va Citizen-requests (murojaat) data
/// manbalari `injection.dart`da `AppConfig.useMock`dan MUSTAQIL ravishda
/// doim shu manzilga ulanadigan HAQIQIY implementatsiyalarga
/// (`AuthApiImpl`/`CitizenRequestsApiImpl`) qattiq bog'langan (hardwired).
///
/// `useMock` esa hali backendi tayyor bo'lmagan boshqa funksiyalar
/// (to'lovlar va h.k.) uchun qoladi — default `true`, kerak bo'lsa
/// `--dart-define=USE_MOCK=false` bilan o'chiriladi.
void main() {
  const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: true);
  AppConfig.init(
    flavor: AppFlavor.prod,
    useMock: useMock,
    apiBaseUrl: 'https://murojaatnoma.uz/api',
  );
  bootstrap.bootstrap();
}
