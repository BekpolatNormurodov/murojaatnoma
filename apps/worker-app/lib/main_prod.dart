import 'package:app_core/app_core.dart';
import 'package:worker_app/main.dart' as bootstrap;

/// Prod flavor entrypoint — real backend ishlab chiqilguncha default mock
/// rejimda qoladi; `--dart-define=USE_MOCK=false` bilan real (jonli)
/// backendga o'tadi.
///
/// `apiBaseUrl` — jonli backend manzili (nginx `/api` prefiksini kesib,
/// qolganini backend root'iga uzatadi, masalan
/// `POST /api/auth/request-otp` -> backend `/auth/request-otp`). Bu qiymat
/// `useMock == true` bo'lganda ham beriladi — zararsiz (mock
/// implementatsiyalar `DioClient`/`AppConfig.apiBaseUrl`ga umuman
/// tegmaydi), lekin `--dart-define=USE_MOCK=false` bilan qurilganda ilova
/// darhol to'g'ri manzilga ulanadi.
void main() {
  const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: true);
  AppConfig.init(
    flavor: AppFlavor.prod,
    useMock: useMock,
    apiBaseUrl: 'https://murojaatnoma.uz/api',
  );
  bootstrap.bootstrap();
}
