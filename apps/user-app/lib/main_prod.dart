import 'package:app_core/app_core.dart';
import 'package:user_app/main.dart' as bootstrap;

/// Prod flavor entrypoint — real backend ishlab chiqilguncha default mock
/// rejimda qoladi; `--dart-define=USE_MOCK=false` bilan real backendga o'tadi.
void main() {
  const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: true);
  AppConfig.init(flavor: AppFlavor.prod, useMock: useMock);
  bootstrap.bootstrap();
}
