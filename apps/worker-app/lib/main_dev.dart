import 'package:app_core/app_core.dart';
import 'package:worker_app/main.dart' as bootstrap;

/// Dev flavor entrypoint — mock ma'lumotlar bilan ishga tushadi.
void main() {
  AppConfig.init(flavor: AppFlavor.dev, useMock: true);
  bootstrap.bootstrap();
}
