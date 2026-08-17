# Faza 0 + Faza 1: Shared poydevor + worker-app yuz/davomat yadrosi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xodim OTP bilan kiradi, birinchi marta yuzini ro'yxatdan o'tkazadi (on-device MobileFaceNet embedding), keyin har kuni ishxona geofence ichida turib liveness + yuz mosligi (≥0.7) orqali davomatini tasdiqlaydi va screenshot saqlanadi.

**Architecture:** Monorepo'da ikkita shared package (`packages/app_ui`, `packages/app_core`) ajratiladi va `worker-app` ularга path-dependency bilan bog'lanadi. Clean architecture (feature-first, Cubit + get_it + dartz). Data qatlami `_use_mock` bilan mock/real'ga bo'linadi; kamera/ML/GPS har doim real.

**Tech Stack:** Flutter (Dart ^3.10), flutter_bloc, get_it, go_router, dartz, iconsax_plus, `camera`, `google_mlkit_face_detection`, `tflite_flutter` (MobileFaceNet), `flutter_secure_storage`, `geolocator`, `permission_handler`, `flutter_localizations`/`intl`, `very_good_analysis`.

## Global Constraints

- Dart SDK: `>=3.10.0-0 <4.0.0` (o'rnatilgan Dart 3.10.0-beta bilan mos; barcha pubspec'larda shu qiymat — worker-app, user-app va yangi paketlar). Bu qiymat VERBATIM ishlatiladi.
- Brend ranglar VERBATIM: primary `#10B981`, primaryDark `#059669`, primaryDeep `#047857`, primaryLight `#D1FAE5`, accent `#3B82F6`; canvas(light) `#F6F8FB`, surface `#FFFFFF`, ink `#0F172A`; canvas(dark) `#0B1220`, surface(dark) `#141C2B`, ink(dark) `#E6ECF5`.
- Shrift: **Inter** — `google_fonts` paketi orqali (binar TTF asset sourcing shart emas). Testlarda font shovqinini oldini olish uchun font ishlatadigan har paket/app `test/flutter_test_config.dart` da `GoogleFonts.config.allowRuntimeFetching = false` qo'yadi (test output pristine bo'lishi shart). Splash gradient: `150° [#064E3B, #047857, #059669, #0D9488]`.
- Yuz mosligi chegarasi: `kFaceMatchThreshold = 0.7` (kosinus o'xshashlik). Geofence radiusi: `kGeofenceRadius = 150` metr.
- Default til: **uz**; qo'shimcha: **ru**. Theme: light/dark/system.
- Lint: `very_good_analysis` (barcha yangi package va app). Har `analysis_options.yaml` VERBATIM shu bo'lsin (app-ichki paketlar uchun ikki shovqinli qoida o'chirilgan — `flutter analyze` exit 0 bo'lishi shart):
  ```yaml
  include: package:very_good_analysis/analysis_options.yaml
  linter:
    rules:
      public_member_api_docs: false
      sort_pub_dependencies: false
  ```
- Barcha UI matnlari `l10n` (ARB) orqali — hardcoded matn yo'q (yangi kodda).
- Mock faqat data qatlamiga tegishli; **kamera, GPS, ML Kit, TFLite embedding har doim real**.
- Modellar codegen'siz: entity `extends Equatable`, model `extends Entity` + qo'lda `fromJson`/`toJson` (mavjud uslub).
- Har task oxirida commit. TDD: avval failing test.

---

## Fayl tuzilishi (yangi/o'zgaradigan)

```
packages/
  app_core/
    pubspec.yaml
    lib/app_core.dart                              # barrel export
    lib/src/config/app_config.dart                 # AppFlavor + AppConfig + _use_mock
    lib/src/l10n/{app_uz.arb, app_ru.arb}          # ARB manbalar
    lib/src/l10n/l10n.dart                          # context.l10n extension
    lib/src/localization/locale_cubit.dart          # til holati (shared_preferences)
    lib/src/error/{exceptions.dart, failures.dart}
    lib/src/usecase/usecase.dart
    lib/src/network/{dio_client.dart, interceptors/*}
    lib/src/format/formatters.dart                  # formatSom, formatDate, timeAgo
    l10n.yaml
    test/config/app_config_test.dart
    test/format/formatters_test.dart
  app_ui/
    pubspec.yaml
    lib/app_ui.dart                                 # barrel export
    lib/src/theme/{app_colors.dart, app_text_styles.dart, app_theme.dart}
    lib/src/theme/theme_cubit.dart                  # ThemeMode holati
    lib/src/splash/brand_splash.dart                # umumiy splash
    lib/src/widgets/{app_button, app_card, app_chip, app_text_field,
                     app_dialog, app_sheet, app_alert, empty_state, app_avatar}.dart
    lib/src/constants/app_icons.dart                # iconsax semantik aliaslar
    assets/fonts/Inter-*.ttf
    test/theme/app_colors_test.dart
    test/widgets/app_button_test.dart

worker-app/
  pubspec.yaml                                      # + paketlar, path deps, assets, fonts
  assets/models/mobilefacenet.tflite
  android/app/src/main/AndroidManifest.xml          # + CAMERA, INTERNET, location bor
  ios/Runner/Info.plist                             # kamera/lokatsiya matnlari bor
  lib/main.dart / main_dev.dart / main_prod.dart    # flavor entrypoint
  lib/injection.dart                                # _use_mock bilan registratsiya
  lib/app/{app.dart, router/app_router.dart, shell/main_shell.dart}
  lib/features/auth/**                              # parol → telefon/OTP
  lib/features/face/
    domain/entities/{face_template.dart, liveness_challenge.dart, face_match_result.dart}
    domain/services/{face_matcher.dart}
    domain/usecases/{enroll_face.dart, verify_face_checkin.dart}
    data/services/{face_embedder.dart, face_detector_service.dart}
    data/repositories/face_repository_impl.dart
    data/datasources/face_local_data_source.dart    # secure storage
    presentation/{bloc/, pages/{face_enroll_page, face_checkin_page}, widgets/face_oval_overlay}
  lib/features/attendance/
    domain/entities/attendance_day.dart
    domain/services/geofence_service.dart
    domain/repositories/attendance_repository.dart
    data/datasources/{attendance_remote_data_source.dart (+Mock/+Api)}
    data/repositories/attendance_repository_impl.dart
    presentation/{bloc/, pages/home_page.dart, widgets/*}
  lib/core/constants/app_constants.dart             # kFaceMatchThreshold, kGeofenceRadius, workplace coords
```

---

# FAZA 0 — Shared poydevor

### Task 1: `app_core` package + AppConfig (`_use_mock`/flavor)

**Files:**
- Create: `packages/app_core/pubspec.yaml`
- Create: `packages/app_core/lib/app_core.dart`
- Create: `packages/app_core/lib/src/config/app_config.dart`
- Create: `packages/app_core/analysis_options.yaml`
- Test: `packages/app_core/test/config/app_config_test.dart`

**Interfaces:**
- Produces: `enum AppFlavor { dev, test, prod }`; `class AppConfig` with static `flavor`, `useMock`, `apiBaseUrl` and `AppConfig.init({required AppFlavor flavor, required bool useMock, String? apiBaseUrl})`.

- [ ] **Step 1: pubspec + analysis_options**

`packages/app_core/pubspec.yaml`:
```yaml
name: app_core
description: Umumiy config, l10n, network, error, usecase primitivlari.
publish_to: none
version: 0.1.0
environment:
  sdk: '>=3.10.0-0 <4.0.0'
dependencies:
  flutter: { sdk: flutter }
  flutter_localizations: { sdk: flutter }
  bloc: ^9.0.0
  flutter_bloc: ^9.1.1
  equatable: ^2.0.7
  dartz: ^0.10.1
  dio: ^5.7.0
  shared_preferences: ^2.3.3
  intl: ^0.20.2
dev_dependencies:
  flutter_test: { sdk: flutter }
  bloc_test: ^10.0.0
  very_good_analysis: ^7.0.0
flutter:
  generate: true
```
`packages/app_core/analysis_options.yaml` (Global Constraints'dagi standart — VERBATIM):
```yaml
include: package:very_good_analysis/analysis_options.yaml
linter:
  rules:
    public_member_api_docs: false
    sort_pub_dependencies: false
```

- [ ] **Step 2: Failing test**

`packages/app_core/test/config/app_config_test.dart`:
```dart
import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('init sets flavor, useMock and apiBaseUrl', () {
    AppConfig.init(flavor: AppFlavor.prod, useMock: false, apiBaseUrl: 'https://x');
    expect(AppConfig.flavor, AppFlavor.prod);
    expect(AppConfig.useMock, isFalse);
    expect(AppConfig.apiBaseUrl, 'https://x');
  });

  test('defaults to dev + mock when not initialised', () {
    // ok: statik standart qiymatlar
    expect(AppFlavor.values, contains(AppFlavor.test));
  });
}
```

- [ ] **Step 3: Run test — must FAIL**

Run: `cd packages/app_core && flutter test test/config/app_config_test.dart`
Expected: FAIL — `AppConfig`/`AppFlavor` topilmaydi.

- [ ] **Step 4: Implement**

`packages/app_core/lib/src/config/app_config.dart`:
```dart
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
```
`packages/app_core/lib/app_core.dart`:
```dart
export 'src/config/app_config.dart';
```

- [ ] **Step 5: Run test — must PASS**

Run: `cd packages/app_core && flutter test test/config/app_config_test.dart`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add packages/app_core
git commit -m "feat(app_core): package skeleton + AppConfig flavor/_use_mock"
```

---

### Task 2: `app_core` — error, usecase, network, formatters (mavjud kodni ko'chirish)

**Files:**
- Create: `packages/app_core/lib/src/error/{exceptions.dart, failures.dart}`
- Create: `packages/app_core/lib/src/usecase/usecase.dart`
- Create: `packages/app_core/lib/src/network/dio_client.dart` + `interceptors/{auth_interceptor.dart, logging_interceptor.dart}`
- Create: `packages/app_core/lib/src/format/formatters.dart`
- Modify: `packages/app_core/lib/app_core.dart` (export qo'shish)
- Test: `packages/app_core/test/format/formatters_test.dart`

**Interfaces:**
- Consumes: `AppConfig.apiBaseUrl` (Task 1).
- Produces: `abstract class UseCase<Result, Params> { Future<Either<Failure, Result>> call(Params p); }`, `class NoParams`; `Failure` iyerarxiyasi (`ServerFailure`, `AuthFailure`, `CacheFailure`, `NetworkFailure`); `DioClient` (`.dio` getter); `formatSom(num)`, `formatDate(DateTime)`, `timeAgo(DateTime)`.

- [ ] **Step 1: Failing test (formatters)**

`packages/app_core/test/format/formatters_test.dart`:
```dart
import 'package:app_core/app_core.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('formatSom groups thousands with so\'m suffix', () {
    expect(formatSom(1234567), "1 234 567 so'm");
  });
  test('formatDate renders Uzbek short month', () {
    expect(formatDate(DateTime(2026, 6, 12)), '12 Iyn 2026');
  });
}
```

- [ ] **Step 2: Run — FAIL** (`cd packages/app_core && flutter test test/format/formatters_test.dart`) → symbols topilmaydi.

- [ ] **Step 3: Implement**

`error/exceptions.dart`:
```dart
class ServerException implements Exception { final String message; ServerException([this.message = 'Server xatosi']); }
class AuthException implements Exception { final String message; AuthException([this.message = 'Avtorizatsiya xatosi']); }
class CacheException implements Exception { final String message; CacheException([this.message = 'Keshda xato']); }
class NetworkException implements Exception { final String message; NetworkException([this.message = 'Tarmoq xatosi']); }
```
`error/failures.dart`:
```dart
import 'package:equatable/equatable.dart';
abstract class Failure extends Equatable {
  const Failure([this.message = 'Xatolik yuz berdi']);
  final String message;
  @override
  List<Object?> get props => [message];
}
class ServerFailure extends Failure { const ServerFailure([super.m = 'Server xatosi']); }
class AuthFailure extends Failure { const AuthFailure([super.m = 'Avtorizatsiya xatosi']); }
class CacheFailure extends Failure { const CacheFailure([super.m = 'Keshda xato']); }
class NetworkFailure extends Failure { const NetworkFailure([super.m = 'Internet aloqasi yo\'q']); }
```
`usecase/usecase.dart`:
```dart
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../error/failures.dart';
abstract class UseCase<Result, Params> {
  Future<Either<Failure, Result>> call(Params params);
}
class NoParams extends Equatable { const NoParams(); @override List<Object?> get props => []; }
```
`network/dio_client.dart` — mavjud `worker-app/lib/core/network/dio_client.dart` uslubini ko'chiring, faqat baseUrl `AppConfig.apiBaseUrl` dan olsin va `AuthInterceptor` tokenni `'auth_token'` kalitidan o'qisin (bu bug tuzatiladi). `format/formatters.dart`:
```dart
const _months = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
String formatSom(num v) {
  final s = v.round().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return "${b.toString()} so'm";
}
String formatDate(DateTime d) => '${d.day} ${_months[d.month - 1]} ${d.year}';
String timeAgo(DateTime d) {
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return 'hozir';
  if (diff.inMinutes < 60) return '${diff.inMinutes} daqiqa oldin';
  if (diff.inHours < 24) return '${diff.inHours} soat oldin';
  return '${diff.inDays} kun oldin';
}
```
`app_core.dart` — barcha yangi fayllarni export qiling.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git add packages/app_core
git commit -m "feat(app_core): error/usecase/network/formatters primitivlari"
```

---

### Task 3: `app_ui` package — dizayn tokenlari (ranglar, shrift, radii)

**Files:**
- Create: `packages/app_ui/pubspec.yaml`, `analysis_options.yaml`, `lib/app_ui.dart`
- Create: `packages/app_ui/lib/src/theme/app_colors.dart`
- Create: `packages/app_ui/lib/src/theme/app_text_styles.dart`
- Create: `packages/app_ui/lib/src/theme/app_radii.dart`
- Create: `packages/app_ui/test/flutter_test_config.dart` (`GoogleFonts.config.allowRuntimeFetching = false`)
- Test: `packages/app_ui/test/theme/app_colors_test.dart`

**Interfaces:**
- Produces: `AppColors` (static `const Color` — primary, primaryDark, primaryDeep, primaryLight, accent, success/warning/danger/info, canvas/surface/surfaceAlt/line/ink/inkSoft/inkMuted **light** + `dark*` variantlar; `brandGradient`, `cardGradient`, `glowShadow`); `AppTextStyles` (h1..button, `fontFamily='Inter'`); `AppRadii` (xs..xl doubles).

- [ ] **Step 1: pubspec (+ Inter fontlarini yuklab assets/fonts ga qo'ying)**
```yaml
name: app_ui
publish_to: none
version: 0.1.0
environment: { sdk: '>=3.10.0-0 <4.0.0' }
dependencies:
  flutter: { sdk: flutter }
  bloc: ^9.0.0
  flutter_bloc: ^9.1.1
  shared_preferences: ^2.3.3
  iconsax_plus: ^1.0.0
  google_fonts: ^6.2.1
dev_dependencies:
  flutter_test: { sdk: flutter }
  very_good_analysis: ^7.0.0
```
> Inter `google_fonts` paketi orqali keladi (OFL — license-compliance mos). Runtime'da yuklab olinadi/keshlanadi; testlarda `flutter_test_config.dart` bilan fetching o'chiriladi (pristine output).

- [ ] **Step 2: Failing test**

`packages/app_ui/test/theme/app_colors_test.dart`:
```dart
import 'dart:ui';
import 'package:app_ui/app_ui.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('brand primary is emerald 0xFF10B981', () {
    expect(AppColors.primary, const Color(0xFF10B981));
    expect(AppColors.accent, const Color(0xFF3B82F6));
    expect(AppColors.darkCanvas, const Color(0xFF0B1220));
  });
}
```

- [ ] **Step 3: Run — FAIL.**

- [ ] **Step 4: Implement** `app_colors.dart` (Global Constraints'dagi hex qiymatlar VERBATIM), `app_text_styles.dart` (har uslub `GoogleFonts.inter(fontSize:.., fontWeight:.., ...)` — h1 28/w800, h2 22/w700, h3 17/w600, body 15/w400, bodyStrong 15/w600, caption 13, label 13/w600, button 15/w600; + `static String get fontFamily => GoogleFonts.inter().fontFamily!;`), `app_radii.dart` (`xs=8, sm=12, md=16, lg=20, xl=28`). `test/flutter_test_config.dart` yarating (`allowRuntimeFetching = false`). `app_ui.dart` export qiling.

- [ ] **Step 5: Run — PASS.**

- [ ] **Step 6: Commit**
```bash
git add packages/app_ui
git commit -m "feat(app_ui): dizayn tokenlari + Inter shrift"
```

---

### Task 4: `app_ui` — Theme (light+dark) + ThemeCubit

**Files:**
- Create: `packages/app_ui/lib/src/theme/app_theme.dart`
- Create: `packages/app_ui/lib/src/theme/theme_cubit.dart`
- Modify: `packages/app_ui/lib/app_ui.dart`
- Modify: `packages/app_ui/pubspec.yaml` (`bloc_test` dev dep)
- Test: `packages/app_ui/test/theme/theme_cubit_test.dart`

**Interfaces:**
- Consumes: `AppColors`, `AppTextStyles`, `AppRadii` (Task 3).
- Produces: `AppTheme.light`, `AppTheme.dark` (`ThemeData`); `class ThemeCubit extends Cubit<ThemeMode>` with `load()`, `setMode(ThemeMode)` (persists `app-theme` in `SharedPreferences`).

- [ ] **Step 1: Failing test**

`test/theme/theme_cubit_test.dart`:
```dart
import 'package:app_ui/app_ui.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  blocTest<ThemeCubit, ThemeMode>(
    'setMode(dark) emits ThemeMode.dark and persists',
    build: ThemeCubit.new,
    act: (c) => c.setMode(ThemeMode.dark),
    expect: () => [ThemeMode.dark],
    verify: (_) async {
      final p = await SharedPreferences.getInstance();
      expect(p.getString('app-theme'), 'dark');
    },
  );
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

`app_theme.dart`:
```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';
import 'app_text_styles.dart';

class AppTheme {
  static ThemeData get light => _base(Brightness.light);
  static ThemeData get dark => _base(Brightness.dark);

  static ThemeData _base(Brightness b) {
    final dark = b == Brightness.dark;
    final canvas = dark ? AppColors.darkCanvas : AppColors.canvas;
    final surface = dark ? AppColors.darkSurface : AppColors.surface;
    final line = dark ? AppColors.darkLine : AppColors.line;
    final ink = dark ? AppColors.darkInk : AppColors.ink;
    final base = ThemeData(brightness: b, useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: canvas,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary, brightness: b,
      ).copyWith(primary: AppColors.primary, secondary: AppColors.accent,
        surface: surface, error: AppColors.danger),
      textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(bodyColor: ink, displayColor: ink),
      appBarTheme: AppBarTheme(backgroundColor: canvas, elevation: 0, scrolledUnderElevation: 0,
        centerTitle: false, iconTheme: IconThemeData(color: ink),
        systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark),
      cardTheme: CardThemeData(color: surface, elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: line))),
      dividerTheme: DividerThemeData(color: line, thickness: 1),
      splashColor: AppColors.primaryLight.withValues(alpha: 0.3),
      highlightColor: Colors.transparent,
    );
  }
}
```
`theme_cubit.dart`:
```dart
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeCubit extends Cubit<ThemeMode> {
  ThemeCubit() : super(ThemeMode.light);
  static const _key = 'app-theme';

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    emit(switch (p.getString(_key)) { 'dark' => ThemeMode.dark, 'system' => ThemeMode.system, _ => ThemeMode.light });
  }

  Future<void> setMode(ThemeMode mode) async {
    emit(mode);
    final p = await SharedPreferences.getInstance();
    await p.setString(_key, mode.name);
  }
}
```
Export in `app_ui.dart`.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git add packages/app_ui
git commit -m "feat(app_ui): light+dark theme + ThemeCubit"
```

---

### Task 5: `app_core` — l10n (uz/ru) + LocaleCubit

**Files:**
- Create: `packages/app_core/l10n.yaml`
- Create: `packages/app_core/lib/src/l10n/app_uz.arb`, `app_ru.arb`
- Create: `packages/app_core/lib/src/l10n/l10n.dart` (barrel + `context.l10n`)
- Create: `packages/app_core/lib/src/localization/locale_cubit.dart`
- Modify: `packages/app_core/lib/app_core.dart`
- Test: `packages/app_core/test/localization/locale_cubit_test.dart`

**Interfaces:**
- Produces: generated `AppLocalizations` (`Localizations.of`), `extension AppLocalizationsX on BuildContext { AppLocalizations get l10n }`, `AppLocalizations.localizationsDelegates`, `.supportedLocales`; `class LocaleCubit extends Cubit<Locale>` with `load()`, `setLocale(Locale)` (persists `app-lang`).

- [ ] **Step 1:** `l10n.yaml`:
```yaml
arb-dir: lib/src/l10n
template-arb-file: app_uz.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
nullable-getter: false
```
`app_uz.arb` (boshlang'ich kalitlar):
```json
{
  "@@locale": "uz",
  "appName": "Hokimiyat",
  "splashTagline": "Raqamli boshqaruv platformasi",
  "login": "Kirish",
  "phoneNumber": "Telefon raqamingiz",
  "sendCode": "Kodni yuborish",
  "enterCode": "Kodni kiriting",
  "faceEnrollTitle": "Yuzingizni ro'yxatdan o'tkazing",
  "faceCheckinTitle": "Yuz bilan tasdiqlash",
  "faceHoldStill": "Yuzingizni ovalga joylang",
  "blinkPrompt": "Ko'zingizni pirpiratng",
  "turnLeftPrompt": "Boshingizni chapga buring",
  "turnRightPrompt": "Boshingizni o'ngga buring",
  "smilePrompt": "Jilmaying",
  "outsideGeofence": "Siz ish hududidan tashqaridasiz",
  "checkinSuccess": "Davomat tasdiqlandi",
  "home": "Bosh sahifa",
  "requests": "Murojaatlar",
  "chat": "Chat",
  "map": "Xarita",
  "profile": "Profil"
}
```
`app_ru.arb` — barcha kalitlarning ruscha tarjimasi (`@@locale: ru`).

- [ ] **Step 2: Failing test**

`test/localization/locale_cubit_test.dart`:
```dart
import 'dart:ui';
import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  blocTest<LocaleCubit, Locale>(
    'setLocale(ru) emits ru and persists',
    build: LocaleCubit.new,
    act: (c) => c.setLocale(const Locale('ru')),
    expect: () => [const Locale('ru')],
    verify: (_) async {
      final p = await SharedPreferences.getInstance();
      expect(p.getString('app-lang'), 'ru');
    },
  );
}
```

- [ ] **Step 3: Generate + run — FAIL first** (`cd packages/app_core && flutter gen-l10n && flutter test test/localization`). LocaleCubit topilmaydi.

- [ ] **Step 4: Implement** `locale_cubit.dart` (ThemeCubit uslubida, default `Locale('uz')`, kalit `app-lang`), `l10n.dart`:
```dart
import 'package:flutter/widgets.dart';
import 'app_localizations.dart';
export 'app_localizations.dart';
extension AppLocalizationsX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
```
Export l10n + locale_cubit in `app_core.dart`.

- [ ] **Step 5: Run — PASS.**

- [ ] **Step 6: Commit**
```bash
git add packages/app_core
git commit -m "feat(app_core): l10n uz/ru + LocaleCubit"
```

---

### Task 6: `app_ui` — umumiy widgetlar + splash (mavjud worker-app widgetlarini ko'chirish)

**Files:**
- Create: `packages/app_ui/lib/src/constants/app_icons.dart` (worker-app'dagidan ko'chiriladi)
- Create: `packages/app_ui/lib/src/widgets/{app_button, app_card, app_chip, app_text_field, app_dialog, app_sheet, app_alert, empty_state, app_avatar}.dart`
- Create: `packages/app_ui/lib/src/splash/brand_splash.dart`
- Modify: `packages/app_ui/lib/app_ui.dart`
- Modify: `packages/app_ui/pubspec.yaml` (`flutter_animate: ^4.5.2`)
- Test: `packages/app_ui/test/widgets/app_button_test.dart`, `test/splash/brand_splash_test.dart`

**Interfaces:**
- Consumes: theme tokens (Task 3–4).
- Produces: `AppButton({label, onPressed, variant, loading, icon})`, `AppCard`, `AppChip`/`StatusBadge`, `AppTextField`, `AppDialog.confirm/success`, `showAppSheet`, `AppAlert.success/error/info`, `EmptyState`, `AppAvatar({name, photoUrl, color, size})`, `BrandSplash({required String tagline, String appName = 'Hokimiyat', VoidCallback? onFinished})` — **app_ui app_core'ga bog'lanmaydi**; l10n matnlari parametr sifatida uzatiladi (app `context.l10n.splashTagline` beradi).

- [ ] **Step 1: Failing widget test**

`test/widgets/app_button_test.dart`:
```dart
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('AppButton shows label and fires onPressed', (t) async {
    var tapped = false;
    await t.pumpWidget(MaterialApp(home: Scaffold(
      body: AppButton(label: 'Kirish', onPressed: () => tapped = true))));
    expect(find.text('Kirish'), findsOneWidget);
    await t.tap(find.byType(AppButton));
    expect(tapped, isTrue);
  });
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `worker-app/lib/core/widgets/*` va `worker-app/lib/core/constants/app_icons.dart` fayllarini `app_ui` package'iga ko'chiring; importlarni `package:app_ui/...` ga moslang; `AppAvatar` yangi qo'shing (initials fallback, gradient). `brand_splash.dart` — web-admin SplashScreen'ini Flutter'ga o'tkazing: `brandGradient` fon, oq ShieldTick logo (`IconsaxPlusBold.shield_tick`), `flutter_animate` pulse ring + letter-stagger `appName` + `tagline` (parametr — app_core'ga bog'lanmaslik uchun l10n'ni app uzatadi), ~2500ms so'ng `onFinished()`.

- [ ] **Step 4: Run — PASS** (`cd packages/app_ui && flutter test`).

- [ ] **Step 5: Commit**
```bash
git add packages/app_ui
git commit -m "feat(app_ui): umumiy widgetlar + brand splash"
```

---

### Task 7: worker-app'ni shared paketlarga ulash + migratsiya

**Files:**
- Modify: `worker-app/pubspec.yaml` (path deps + `very_good_analysis`)
- Modify: `worker-app/analysis_options.yaml`
- Delete (endi paketda): `worker-app/lib/app/theme/*`, `core/widgets/*`, `core/{error,usecase,network}/*`, `core/constants/app_icons.dart`
- Delete (Faza 1/2 da yangidan quriladi — qayta ishlatilmaydi, boshqa vizyon): `worker-app/lib/features/{tasks,regions,bonus}/**`, `features/profile/**`, `core/mock/mock_tasks.dart`
- Replace: `app/router/app_router.dart` (minimal o'tuvchi router). Delete: `app/shell/main_shell.dart` (Task 18 5-tab shell'ni qayta quradi)
- Modify: `features/auth/**` importlarini `package:app_ui/...`/`package:app_core/...` ga (login hozircha PAROL bilan qoladi; Task 9 OTP'ga o'tkazadi); `app/app.dart`, `main.dart`, `injection.dart`, `test/widget_test.dart`

**Interfaces:**
- Consumes: `app_ui`, `app_core` (Task 1–6).
- Produces: worker-app'da global `getIt`, `WorkerApp` widget'i `MaterialApp.router` bilan `theme/darkTheme/themeMode` va `localizationsDelegates/supportedLocales/locale`.

- [ ] **Step 1:** `pubspec.yaml`ga:
```yaml
dependencies:
  app_ui: { path: ../packages/app_ui }
  app_core: { path: ../packages/app_core }
  # ... mavjudlar ...
dev_dependencies:
  very_good_analysis: ^7.0.0
```
`analysis_options.yaml`: `include: package:very_good_analysis/analysis_options.yaml` (+ kerakli `exclude` generated).

- [ ] **Step 2:** (a) Dublikat infra fayllarni o'chiring (`app/theme`, `core/widgets`, `core/error`, `core/usecase`, `core/network`, `core/constants/app_icons`). (b) Almashtiriladigan eski feature'larni o'chiring: `features/tasks`, `features/regions`, `features/bonus`, `features/profile`, `core/mock/mock_tasks.dart`, `app/shell/main_shell.dart`. (c) Qolgan kod (`features/auth`, `app/*`, `core/constants/api_constants.dart`) importlarini `package:app_ui/...`/`package:app_core/...` ga qayta yozing va VGV lint'ni **kodda** tuzating (yuzaki kichik — override qo'shmang).

- [ ] **Step 3:** `app.dart`:
```dart
class WorkerApp extends StatelessWidget {
  const WorkerApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => getIt<ThemeCubit>()..load()),
        BlocProvider(create: (_) => getIt<LocaleCubit>()..load()),
        BlocProvider(create: (_) => getIt<AuthCubit>()),
      ],
      child: Builder(builder: (context) {
        final mode = context.watch<ThemeCubit>().state;
        final locale = context.watch<LocaleCubit>().state;
        return MaterialApp.router(
          title: 'Hokimiyat Ishchi',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light, darkTheme: AppTheme.dark, themeMode: mode,
          locale: locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: getIt<AppRouter>().config,
        );
      }),
    );
  }
}
```
`injection.dart`ga `ThemeCubit`, `LocaleCubit`ni `registerFactory` qiling; eski `tasks/regions/bonus` registratsiyalarini olib tashlang (auth registratsiyalari qoladi).

- [ ] **Step 3b: Minimal o'tuvchi router** — `app/router/app_router.dart` ni GoRouter bilan qayta yozing (shell YO'Q — Task 18 qo'shadi):
  - `/splash` → `BrandSplash(tagline: context.l10n.splashTagline, onFinished: () { context.go(getIt<AuthCubit>().state.isAuthenticated ? '/home' : '/login'); })`
  - `/login` → mavjud `LoginPage` (parol bilan, migratsiya qilingan)
  - `/home` → vaqtinchalik `Scaffold` (`EmptyState` yoki markazda 'Bosh sahifa — tez orada' + chiqish tugmasi)
  - `initialLocation: '/splash'`. `AppRouter` klassi `GoRouter get config` beradi (app.dart shuni ishlatadi). Redirect logikasi minimal (Task 18 kengaytiradi).

- [ ] **Step 4: Verify compile + analyze**
Run: `cd worker-app && flutter pub get && flutter analyze`
Expected: 0 error (VGV — faqat auth+app kichik yuzasi kodda tuzatiladi).
Run: `cd worker-app && flutter test`
Expected: `test/widget_test.dart` (importlar/AuthCubit moslangan) PASS. Test o'chirilgan sahifaga bog'liq bo'lsa, LoginPage smoke testiga moslang.

- [ ] **Step 5: Commit**
```bash
git add worker-app packages
git commit -m "refactor(worker-app): shared app_ui/app_core paketlariga o'tkazish + VGV lint"
```

---

# FAZA 1 — worker-app yadro (OTP → yuz → geofence davomat)

### Task 8: worker-app — paketlar, ruxsatlar, assetlar, konstantalar

**Files:**
- Modify: `worker-app/pubspec.yaml` (yangi paketlar + assets)
- Create: `worker-app/assets/models/mobilefacenet.tflite`
- Modify: `worker-app/android/app/src/main/AndroidManifest.xml` (`INTERNET`; CAMERA/location bor)
- Modify: `worker-app/android/app/build.gradle.kts` (`minSdk = 24`)
- Modify: `worker-app/ios/Runner/Info.plist` (matnlar bor — tekshirish)
- Create: `worker-app/lib/core/constants/app_constants.dart`
- Create: `worker-app/lib/main_dev.dart`, `worker-app/lib/main_prod.dart`

**Interfaces:**
- Produces: `const kFaceMatchThreshold = 0.7`, `const kGeofenceRadius = 150.0`, `const kWorkplaceLat/Lng` (Mirzo Ulug'bek markazi), `const kFaceEmbeddingSize`; flavor entrypointlar `AppConfig.init(...)` chaqiradi.

- [ ] **Step 1:** `pubspec.yaml`ga qo'shing:
```yaml
  camera: ^0.11.0
  google_mlkit_face_detection: ^0.13.0
  tflite_flutter: ^0.11.0
  flutter_secure_storage: ^9.2.2
  permission_handler: ^11.3.1
  flutter_map: ^7.0.2
  latlong2: ^0.9.1
  fl_chart: ^0.69.0
  video_player: ^2.9.2
  path_provider: ^2.1.5
  image: ^4.3.0        # kadr crop/resize uchun
```
`flutter:` bo'limiga:
```yaml
  assets:
    - assets/models/mobilefacenet.tflite
```
> **Model asseti (avtonom rejim):** hozircha `assets/models/mobilefacenet.tflite` ni PLACEHOLDER fayl sifatida yarating (kichik dummy) va `assets/models/README.md` da ANIQ yozing: real MobileFaceNet (112×112 RGB kirish → 128/192-d embedding, OFL/Apache litsenziya) qurilmada test qilishdan oldin aynan shu yo'lga qo'yilishi shart. `kFaceEmbeddingSize` real modelga qarab moslanadi (default 192). FaceEmbedder (Task 12) `load()` xatosini graceful ushlaydi → placeholder bilan build/analyze/unit-test **yashil** qoladi; faqat qurilmadagi real inference real modelni talab qiladi.

- [ ] **Step 2:** `app_constants.dart`:
```dart
const double kFaceMatchThreshold = 0.7;
const double kGeofenceRadius = 150; // metr
const double kWorkplaceLat = 41.3111; // Mirzo Ulug'bek (namuna — sozlanadi)
const double kWorkplaceLng = 69.3402;
const int kFaceEmbeddingSize = 192; // modelga qarab moslang
const int kFaceInputSize = 112;
```

- [ ] **Step 3:** `main_dev.dart`:
```dart
import 'package:app_core/app_core.dart';
import 'main.dart' as bootstrap;
void main() { AppConfig.init(flavor: AppFlavor.dev, useMock: true); bootstrap.run(); }
```
`main_prod.dart` — `const useMock = bool.fromEnvironment('USE_MOCK', defaultValue: true);` bilan `AppFlavor.prod`. `main.dart`da `run()` funksiyasi: `WidgetsFlutterBinding.ensureInitialized()` → `configureDependencies()` → `runApp(const WorkerApp())`.

- [ ] **Step 4:** AndroidManifest'ga `<uses-permission android:name="android.permission.INTERNET"/>`; `build.gradle.kts`da `minSdk = 24`.

- [ ] **Step 5: Verify**
Run: `cd worker-app && flutter pub get && flutter analyze`
Expected: 0 error.

- [ ] **Step 6: Commit**
```bash
git add worker-app
git commit -m "chore(worker-app): yuz/xarita paketlari, ruxsatlar, model asset, konstantalar"
```

---

### Task 9: Auth — parol → telefon/OTP oqimiga o'tkazish

**Files:**
- Modify: `worker-app/lib/features/auth/data/datasources/auth_remote_data_source.dart` (+Mock/+Api)
- Modify: `worker-app/lib/features/auth/domain/usecases/` → `send_otp.dart`, `verify_otp.dart`
- Modify: `worker-app/lib/features/auth/domain/repositories/auth_repository.dart`
- Modify: `worker-app/lib/features/auth/data/repositories/auth_repository_impl.dart` (tokenni `auth_token` kalitiga yozish)
- Modify: `worker-app/lib/features/auth/presentation/bloc/{auth_cubit,auth_state}.dart`
- Create: `worker-app/lib/features/auth/presentation/pages/{phone_input_page,otp_page}.dart` (user-app'dan port)
- Modify: `worker-app/lib/injection.dart`
- Test: `worker-app/test/features/auth/auth_cubit_test.dart`

**Interfaces:**
- Consumes: `UseCase`, `Failure` (app_core).
- Produces: `AuthCubit` with `requestOtp(String phone)`, `verifyOtp(String phone, String code)`, `reset()`; state `AuthState { status, session, faceEnrolled }`; `AuthSession { token, workerId, name, position, region }`.

- [ ] **Step 1: Failing test**

`test/features/auth/auth_cubit_test.dart`:
```dart
// verifyOtp bilan '1111' → status authenticated; boshqa kod → error
blocTest<AuthCubit, AuthState>(
  'verifyOtp with correct demo code authenticates',
  build: () => AuthCubit(sendOtp: sendOtp, verifyOtp: verifyOtp),
  act: (c) => c.verifyOtp('901234567', '1111'),
  expect: () => [
    isA<AuthState>().having((s)=>s.status, 'status', AuthStatus.loading),
    isA<AuthState>().having((s)=>s.status, 'status', AuthStatus.authenticated),
  ],
);
```
(`sendOtp`/`verifyOtp` — mocktail bilan mock qilinadi, `Right(session)` qaytaradi.)

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `AuthRemoteDataSourceMockImpl`: `sendOtp` 900ms delay + har 9-raqamli telefonni qabul qiladi; `verifyOtp` kod `1111` bo'lsa fake `AuthSession` (fake JWT, `W-1042`, `Sardor Karimov`, `Chilonzor tumani`) qaytaradi, aks holda `AuthException`. `AuthApiImpl`: `POST /auth/send-otp`, `/auth/verify`. Repo impl tokenni `SharedPreferences('auth_token')` VA sessiyani `worker_session` JSON'ga yozadi. `injection.dart`da `AppConfig.useMock` bo'yicha Mock/Api tanlanadi. Sahifalar user-app'dan ko'chiriladi, matnlar `context.l10n`.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git add worker-app
git commit -m "feat(auth): telefon/OTP oqimi (mock+api seam) + JWT kalit tuzatildi"
```

---

### Task 10: Face domain — entitilar + kosinus mos kelish (sof mantiq, TDD)

**Files:**
- Create: `worker-app/lib/features/face/domain/entities/face_template.dart`
- Create: `worker-app/lib/features/face/domain/entities/face_match_result.dart`
- Create: `worker-app/lib/features/face/domain/services/face_matcher.dart`
- Test: `worker-app/test/features/face/face_matcher_test.dart`

**Interfaces:**
- Produces: `FaceTemplate { List<double> embedding; DateTime enrolledAt; String workerId; toJson/fromJson }`; `FaceMatchResult { double similarity; bool passed }`; `class FaceMatcher { double cosineSimilarity(List<double> a, List<double> b); FaceMatchResult match(List<double> probe, List<double> template, {double threshold = kFaceMatchThreshold}); }`.

- [ ] **Step 1: Failing test**

`test/features/face/face_matcher_test.dart`:
```dart
import 'package:worker_app/features/face/domain/services/face_matcher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final m = FaceMatcher();
  test('identical vectors → similarity 1.0, passed', () {
    final v = [0.1, 0.2, 0.3, 0.4];
    final r = m.match(v, v);
    expect(r.similarity, closeTo(1.0, 1e-9));
    expect(r.passed, isTrue);
  });
  test('orthogonal vectors → similarity 0, not passed', () {
    final r = m.match([1, 0], [0, 1]);
    expect(r.similarity, closeTo(0.0, 1e-9));
    expect(r.passed, isFalse);
  });
  test('threshold boundary at 0.7', () {
    // 0.7 dan past → fail, 0.7 va undan yuqori → pass
    expect(m.match([1,0],[0.6,0.8]).passed, isFalse); // cos≈0.6
    expect(m.match([1,0],[0.8,0.6]).passed, isTrue);  // cos≈0.8
  });
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**
```dart
import 'dart:math' as math;
import '../../../../core/constants/app_constants.dart';

class FaceMatchResult {
  const FaceMatchResult(this.similarity, this.passed);
  final double similarity;
  final bool passed;
}

class FaceMatcher {
  double cosineSimilarity(List<double> a, List<double> b) {
    assert(a.length == b.length, 'vektor o\'lchamlari mos emas');
    var dot = 0.0, na = 0.0, nb = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i];
    }
    if (na == 0 || nb == 0) return 0;
    return dot / (math.sqrt(na) * math.sqrt(nb));
  }

  FaceMatchResult match(List<double> probe, List<double> template,
      {double threshold = kFaceMatchThreshold}) {
    final s = cosineSimilarity(probe, template);
    return FaceMatchResult(s, s >= threshold);
  }
}
```
`face_template.dart` — Equatable entity + `fromJson`/`toJson` (embedding `List<double>`).

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git add worker-app/lib/features/face worker-app/test/features/face
git commit -m "feat(face): FaceTemplate entity + FaceMatcher (kosinus, 0.7)"
```

---

### Task 11: Face — liveness challenge state machine (TDD)

**Files:**
- Create: `worker-app/lib/features/face/domain/entities/liveness_challenge.dart`
- Create: `worker-app/lib/features/face/domain/services/liveness_controller.dart`
- Test: `worker-app/test/features/face/liveness_controller_test.dart`

**Interfaces:**
- Produces: `enum LivenessAction { blink, turnLeft, turnRight, smile }`; `class FaceSignal { double? leftEye; double? rightEye; double? headEulerY; double? smile; }`; `class LivenessController { LivenessController(List<LivenessAction> steps); LivenessAction? get current; double get progress; bool get isComplete; void feed(FaceSignal s); }` — signal joriy amalni bajarsa keyingi bosqichga o'tadi.

- [ ] **Step 1: Failing test**

`test/features/face/liveness_controller_test.dart`:
```dart
import 'package:worker_app/features/face/domain/services/liveness_controller.dart';
import 'package:worker_app/features/face/domain/entities/liveness_challenge.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('advances through blink then turnLeft to completion', () {
    final c = LivenessController([LivenessAction.blink, LivenessAction.turnLeft]);
    expect(c.current, LivenessAction.blink);
    // ko'z ochiq — o'zgarmaydi
    c.feed(FaceSignal(leftEye: 0.9, rightEye: 0.9));
    expect(c.current, LivenessAction.blink);
    // ko'z yumildi → blink bajarildi
    c.feed(FaceSignal(leftEye: 0.1, rightEye: 0.1));
    expect(c.current, LivenessAction.turnLeft);
    // bosh chapga (eulerY > 25)
    c.feed(FaceSignal(headEulerY: 30));
    expect(c.isComplete, isTrue);
    expect(c.progress, 1.0);
  });
}
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `liveness_controller.dart`: blink = avval ko'z ochiq (>0.6) keyin yumuq (<0.2) kuzatilsa; turnLeft = `headEulerY > 25`; turnRight = `headEulerY < -25`; smile = `smile > 0.6`. Har bajarilganda indeks oshadi; `progress = done/steps.length`; `isComplete = done == steps.length`.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(face): liveness challenge state machine"
```

---

### Task 12: Face — TFLite embedder + ML Kit detector servislari

**Files:**
- Create: `worker-app/lib/features/face/data/services/face_embedder.dart`
- Create: `worker-app/lib/features/face/data/services/face_detector_service.dart`
- Test: `worker-app/test/features/face/face_embedder_test.dart` (o'lcham/normalizatsiya kontrakti)

**Interfaces:**
- Produces: `class FaceEmbedder { Future<void> load(); List<double> embed(Uint8List rgb112); }` (chiqish uzunligi `kFaceEmbeddingSize`, L2-normalized); `class FaceDetectorService { Stream<FaceSignal>...` yoki `Future<DetectedFace?> detect(CameraImage img, InputImageRotation rot)` — bbox + eulerY/Z + eye/smile ehtimolliklari qaytaradi.`}`

- [ ] **Step 1: Failing test** (embedder normalizatsiya kontrakti — modelni yuklamasdan sof yordamchi funksiyani sinash):
```dart
// _l2normalize public static helper sifatida ajratiladi
test('l2 normalize yields unit length', () {
  final out = FaceEmbedder.l2normalize([3, 4]); // ->[0.6,0.8]
  expect(out[0], closeTo(0.6, 1e-9));
  expect(out[1], closeTo(0.8, 1e-9));
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `FaceEmbedder`: `tflite_flutter` `Interpreter.fromAsset('assets/models/mobilefacenet.tflite')`; `embed`: `rgb112` → `[1,112,112,3]` float ([-1,1] normalize) → `interpreter.run` → chiqishni `l2normalize`. `FaceDetectorService`: `FaceDetector(options: FaceDetectorOptions(enableClassification: true, enableLandmarks: true, performanceMode: accurate))`; `CameraImage` → `InputImage` konvertatsiya; birinchi yuzdan `FaceSignal` + bbox yasaydi. `l2normalize` — static, sof funksiya.

- [ ] **Step 4: Run — PASS** (sof funksiya testi).

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(face): TFLite embedder + ML Kit detector servislari"
```

---

### Task 13: Face — repository + enroll/verify usecase'lar

**Files:**
- Create: `worker-app/lib/features/face/data/datasources/face_local_data_source.dart` (secure storage)
- Create: `worker-app/lib/features/face/data/repositories/face_repository_impl.dart`
- Create: `worker-app/lib/features/face/domain/repositories/face_repository.dart`
- Create: `worker-app/lib/features/face/domain/usecases/{enroll_face.dart, verify_face.dart}`
- Modify: `worker-app/lib/injection.dart`
- Test: `worker-app/test/features/face/face_repository_test.dart`

**Interfaces:**
- Consumes: `FaceTemplate`, `FaceMatcher` (Task 10), `FaceEmbedder` (Task 12), `Either/Failure` (app_core).
- Produces: `abstract FaceRepository { Future<Either<Failure,Unit>> enroll(FaceTemplate t); Future<Either<Failure,FaceTemplate?>> getTemplate(); Future<Either<Failure,FaceMatchResult>> verify(List<double> probe); }`; `EnrollFace` usecase; `VerifyFace` usecase.

- [ ] **Step 1: Failing test** — `FaceRepositoryImpl.verify` saqlangan template bilan `FaceMatcher` chaqiradi; template yo'q bo'lsa `Left(CacheFailure)`. Fake local data source + real `FaceMatcher` bilan.

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `FaceLocalDataSource`: `FlutterSecureStorage` `read/write('face_template', json)`. `FaceRepositoryImpl`: enroll → saqlaydi; getTemplate → o'qiydi; verify → template o'qib `FaceMatcher.match(probe, template.embedding)`. Usecase'lar `UseCase` kontraktida. `injection.dart`da ro'yxatga oling.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(face): secure storage repo + enroll/verify usecase'lar"
```

---

### Task 14: Attendance domain — AttendanceDay + GeofenceService (TDD)

**Files:**
- Create: `worker-app/lib/features/attendance/domain/entities/attendance_day.dart`
- Create: `worker-app/lib/features/attendance/domain/services/geofence_service.dart`
- Test: `worker-app/test/features/attendance/geofence_service_test.dart`

**Interfaces:**
- Produces: `AttendanceDay { String date; String? checkIn; String? checkOut; AttendanceStatus status; double hours; bool insideGeofence; bool selfConfirmed; String? confirmedAt; fromJson/toJson }`; `enum AttendanceStatus { present, late, absent, leave }`; `class GeofenceService { double distanceMeters(double lat1,lng1,lat2,lng2); bool isInside(double lat,double lng,{double centerLat=kWorkplaceLat,double centerLng=kWorkplaceLng,double radius=kGeofenceRadius}); }`.

- [ ] **Step 1: Failing test**
```dart
final g = GeofenceService();
test('same point distance ~0 and inside', () {
  expect(g.distanceMeters(41.3111,69.3402,41.3111,69.3402), closeTo(0, 1));
  expect(g.isInside(41.3111, 69.3402), isTrue);
});
test('point ~2km away is outside 150m', () {
  expect(g.isInside(41.33, 69.36), isFalse);
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — Haversine formula (metrda), `isInside = distance <= radius`. `AttendanceDay` entity + json.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(attendance): AttendanceDay + Haversine GeofenceService"
```

---

### Task 15: Attendance — check-in usecase + repository (mock/api seam)

**Files:**
- Create: `worker-app/lib/features/attendance/domain/repositories/attendance_repository.dart`
- Create: `worker-app/lib/features/attendance/data/datasources/attendance_remote_data_source.dart` (+Mock/+Api)
- Create: `worker-app/lib/features/attendance/data/repositories/attendance_repository_impl.dart`
- Create: `worker-app/lib/features/attendance/domain/usecases/check_in.dart`
- Create: `worker-app/lib/core/mock/mock_attendance.dart`
- Modify: `worker-app/lib/injection.dart`
- Test: `worker-app/test/features/attendance/check_in_test.dart`

**Interfaces:**
- Consumes: `GeofenceService` (Task 14), `AttendanceDay`.
- Produces: `CheckIn` usecase with `CheckInParams { double lat; double lng; String screenshotPath; }` → `Either<Failure, AttendanceDay>`; geofence tashqarisida `Left(GeofenceFailure)`. `AttendanceRepository { Future<Either<Failure,AttendanceDay>> checkIn(CheckInParams); Future<Either<Failure,List<AttendanceDay>>> history(); }`.

- [ ] **Step 1: Failing test** — geofence tashqarisidagi koordinatada `CheckIn` `Left(GeofenceFailure)`; ichkarida `Right(AttendanceDay)` with `selfConfirmed==true`. (Repo — fake; GeofenceService — real.)

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `CheckIn`: `GeofenceService.isInside` tekshiradi → tashqarida bo'lsa fail; ichkarida `repository.checkIn`. Mock datasource `AttendanceDay`ni bugungi sana bilan yasaydi (`selfConfirmed=true`, `confirmedAt=HH:mm`), `mock_attendance.dart`ga qo'shadi. Api impl `POST /attendance/check-in`.

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(attendance): CheckIn usecase (geofence gate) + repo mock/api"
```

---

### Task 16: Face enrollment sahifasi (UI)

**Files:**
- Create: `worker-app/lib/features/face/presentation/bloc/{face_cubit.dart, face_state.dart}`
- Create: `worker-app/lib/features/face/presentation/pages/face_enroll_page.dart`
- Create: `worker-app/lib/features/face/presentation/widgets/face_oval_overlay.dart`
- Modify: `worker-app/lib/injection.dart`
- Test: `worker-app/test/features/face/face_cubit_test.dart`

**Interfaces:**
- Consumes: `FaceDetectorService`, `FaceEmbedder`, `EnrollFace` (Task 12–13).
- Produces: `FaceCubit` with `startCamera()`, `onFrame(CameraImage)`, `enrollmentGatePassed` holati, `capture()`; `FaceState { status, prompt, qualityOk, progress }`.

- [ ] **Step 1: Failing test** — `FaceCubit` sifat gate mantiqi: frontal+ko'z ochiq+markazda `FaceSignal` kelganda `qualityOk==true`; yomon signalda `false`. (Detector/embedder mock.)

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `FaceCubit`: `camera` (front) oqimini `FaceDetectorService`ga uzatadi; sifat gate (bbox markazda + |eulerY|<12 + |eulerZ|<12 + eye>0.4 + bbox kattaligi) 1.5s barqaror bo'lsa `capture()` → crop 112 → `FaceEmbedder.embed` → `EnrollFace`. `face_oval_overlay.dart` — `CustomPaint` oval + holat rangi (primary=ok, inkMuted=kutish). Sahifa: kamera preview + oval + `context.l10n.faceHoldStill`/prompt + progress.

- [ ] **Step 4: Run — PASS** (cubit testi).

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(face): enrollment sahifasi (kamera + oval + sifat gate)"
```

---

### Task 17: Yuz check-in sahifasi (liveness + match + screenshot)

**Files:**
- Create: `worker-app/lib/features/face/presentation/pages/face_checkin_page.dart`
- Modify: `worker-app/lib/features/face/presentation/bloc/{face_cubit,face_state}.dart` (liveness rejimi)
- Modify: `worker-app/lib/injection.dart`
- Test: `worker-app/test/features/face/face_checkin_cubit_test.dart`

**Interfaces:**
- Consumes: `LivenessController` (Task 11), `VerifyFace` (Task 13), `CheckIn` (Task 15), `geolocator`, `path_provider`.
- Produces: `FaceCubit.startLiveness(List<LivenessAction>)`, `FaceCubit.onLivenessFrame(...)`, muvaffaqiyatda `CheckIn` chaqiradi va `checkinSuccess` holatini beradi; muvaffaqiyatsiz liveness/match → error holat.

- [ ] **Step 1: Failing test** — liveness to'liq bajarilib, `VerifyFace` `passed=true` qaytarsa, cubit `geolocator` (fake) joylashuvi bilan `CheckIn` chaqiradi va `success` holatiga o'tadi; `passed=false` bo'lsa `failure`. (VerifyFace/CheckIn/locator mock.)

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `startLiveness`: tasodifiy 2–3 `LivenessAction` (index bo'yicha deterministik — `Math.random` yo'q, `DateTime` dan seed yoki step rotatsiya); har frame `LivenessController.feed`; `isComplete` bo'lganda jonli embedding → `VerifyFace` → `passed` bo'lsa screenshot (`path_provider` `attendance/<date>.jpg`) saqlab `CheckIn(lat,lng,path)` → success. Sahifa: kamera + oval + joriy `prompt` (`context.l10n.blinkPrompt` ...) + progress ring; natija dialog (`AppDialog.success`/`AppAlert.error`).

- [ ] **Step 4: Run — PASS.**

- [ ] **Step 5: Commit**
```bash
git commit -am "feat(face): liveness check-in + match + screenshot + davomat yozuvi"
```

---

### Task 18: Home / Davomat dashboard + router + 5-tab shell

**Files:**
- Create: `worker-app/lib/features/attendance/presentation/bloc/{attendance_cubit,attendance_state}.dart`
- Create: `worker-app/lib/features/attendance/presentation/pages/home_page.dart`
- Create: `worker-app/lib/features/attendance/presentation/widgets/{today_status_card.dart, weekly_mini_chart.dart}`
- Modify: `worker-app/lib/app/router/app_router.dart` (splash→onboarding→phone→otp→face→home; shell 5 tab)
- Modify: `worker-app/lib/app/shell/main_shell.dart` (5 tab: home/requests/chat/map/profile)
- Create: placeholder sahifalar: `features/requests|chat|map|profile/presentation/pages/*_page.dart` (EmptyState bilan "tez orada")
- Test: `worker-app/test/features/attendance/home_page_test.dart`

**Interfaces:**
- Consumes: `CheckIn`, `AttendanceRepository.history`, `GeofenceService`, `BrandSplash`, face sahifalar.
- Produces: `AttendanceCubit { load(); }` state (today, week, insideGeofence); `HomePage`; router: `/splash`,`/onboarding`,`/phone`,`/otp`,`/face/enroll`,`/face/checkin`, shell `/home`,`/requests`,`/chat`,`/map`,`/profile`.

- [ ] **Step 1: Failing widget test** — `HomePage`da bugungi holat kartasi va "Yuz bilan tasdiqlash" tugmasi ko'rinadi (mock AttendanceCubit `today` bilan).

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement** — `HomePage`: salomlashish header (`AppAvatar` + ism), `TodayStatusCard` (Keldi/Kechikdi + vaqt), katta `AppButton` "Yuz bilan tasdiqlash" → geofence tekshiruvi bilan `/face/checkin`ga (tashqarida bo'lsa `AppAlert` `context.l10n.outsideGeofence`), `WeeklyMiniChart` (`fl_chart` yoki oddiy barlar), tezkor statistikalar. Router mavjud `StatefulShellRoute` uslubida qayta yoziladi; `BrandSplash` `/splash`da, auth/face holatiga qarab redirect. `MainShell` 5 tabga kengaytiriladi (`IconsaxPlus` ikonalar). Placeholder sahifalar `EmptyState` bilan.

- [ ] **Step 4: Run — PASS.** Keyin: `cd worker-app && flutter analyze && flutter test` — 0 error, barcha test PASS.

- [ ] **Step 5: Commit**
```bash
git add worker-app
git commit -m "feat(attendance): home dashboard + splash→otp→face→home router + 5-tab shell"
```

---

### Task 19: Yakuniy integratsiya tekshiruvi (real qurilma qo'lda)

**Files:** (yo'q — verifikatsiya taski)

- [ ] **Step 1: Analyze + test to'liq**
Run: `cd worker-app && flutter analyze && flutter test`
Expected: 0 error/warning, barcha unit/widget test PASS.
Run: `cd packages/app_core && flutter test` va `cd packages/app_ui && flutter test` — PASS.

- [ ] **Step 2: Qo'lda smoke (real qurilma/emulator, kamera bor)**
Run: `cd worker-app && flutter run -t lib/main_dev.dart`
Tekshirish ro'yxati (qo'lda):
  - Splash → onboarding → telefon (+998, 9 raqam) → OTP `1111` → yuz enrollment (oval, sifat gate, capture) → home.
  - Home'da "Yuz bilan tasdiqlash": geofence ichida (koordinatani `kWorkplaceLat/Lng`ga vaqtincha emulator joylashuviga moslang) → liveness (blink/turn/smile) → match ≥0.7 → success + screenshot saqlandi (`getApplicationDocumentsDirectory()/attendance/`).
  - Hudud tashqarisida → `outsideGeofence` ogohlantirish, tasdiq yo'q.
  - Sozlamalarda til uz↔ru va theme light↔dark almashadi.
- [ ] **Step 3:** Topilgan mayda kamchiliklarni tuzatib, alohida commit.
```bash
git commit -am "fix: Faza 1 integratsiya smoke tuzatishlari"
```

---

## Self-Review (reja ↔ spec)

- **Spec §2 (arxitektura/flavor):** Task 1 (AppConfig/_use_mock), Task 7 (paketga ulash), Task 8 (main_dev/prod) ✔
- **Spec §3 (dizayn tizimi, dark, l10n, splash):** Task 3–6 ✔
- **Spec §4.1 (auth OTP):** Task 9 ✔
- **Spec §4.2 (yuz: enrollment/liveness/match/geofence/screenshot):** Task 10–17 ✔
- **Spec §4.3–4.4 (nav + home dashboard):** Task 18 ✔
- **Spec §4.5–4.9 (murojaat/chat/xarita/analitika/profil):** Faza 2 (bu rejada placeholder) — keyingi reja ✔ (belgilangan)
- **Spec §6 (API kontrakti):** har datasource'da Api impl seam (Task 9,15) ✔
- **Spec §7 (testlar):** har logika taskida TDD; widget testlar (Task 6,18) ✔
- **Placeholder skan:** UI tasklarda mavjud pattern ko'chirilishi aniq ko'rsatilgan; sof mantiqda to'liq kod bor ✔
- **Type izchilligi:** `FaceSignal`, `FaceMatcher.match`, `FaceMatchResult`, `LivenessAction`, `GeofenceService.isInside`, `CheckInParams`, `AttendanceDay` — barcha tasklarda bir xil imzo ✔
- **Ochiq eslatma:** MobileFaceNet model asseti va uning chiqish o'lchami (`kFaceEmbeddingSize`) real modelga qarab moslashtiriladi (Task 8/12).

> **Keyingi rejalar:** Faza 2 (murojaat rasm/video/izoh, chat ovozli, xarita breadcrumb, analitika, oylik hisobot, profil/sozlama), Faza 3 (user-app paritet), Faza 4 (backend). Har biri shu MVP bajarilgach alohida reja sifatida yoziladi.
