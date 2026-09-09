import 'package:app_core/app_core.dart';
import 'package:worker_app/main.dart' as bootstrap;

/// Prod flavor entrypoint — jonli backend (murojaatnoma.uz) TAYYOR, shuning
/// uchun default REAL rejim: `flutter build apk --target lib/main_prod.dart`
/// darhol jonli backendga ulanadi. Zarur bo'lsa `--dart-define=USE_MOCK=true`
/// bilan yana mock rejimga qaytarish mumkin.
///
/// `apiBaseUrl` — jonli backend manzili (nginx `/api` prefiksini kesib,
/// qolganini backend root'iga uzatadi, masalan
/// `POST /api/auth/request-otp` -> backend `/auth/request-otp`). Bu qiymat
/// `useMock == true` bo'lganda ham beriladi — zararsiz (mock
/// implementatsiyalar `DioClient`/`AppConfig.apiBaseUrl`ga umuman
/// tegmaydi), lekin `--dart-define=USE_MOCK=false` bilan qurilganda ilova
/// darhol to'g'ri manzilga ulanadi.
void main() {
  const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: false);
  AppConfig.init(
    flavor: AppFlavor.prod,
    useMock: useMock,
    apiBaseUrl: 'https://murojaatnoma.uz/api',
  );
  bootstrap.bootstrap();
}
