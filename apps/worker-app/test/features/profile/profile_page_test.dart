import 'dart:typed_data';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/usecases/login_employee.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/face/data/services/face_photo_store.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/features/profile/presentation/pages/profile_page.dart';
import 'package:worker_app/injection.dart';

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockLoginEmployee extends Mock implements LoginEmployee {}

class _MockRestoreSession extends Mock implements RestoreSession {}

/// Berilgan shablon/rasm-yo'lni qaytaradigan soxta yuz-repozitoriy —
/// profil sarlavhasi `getIt` orqali shu qiymatlarni o'qiydi.
class _FakeFaceRepository implements FaceRepository {
  _FakeFaceRepository(this._template);

  final FaceTemplate? _template;

  @override
  Future<Either<Failure, Unit>> enroll(FaceTemplate t) async =>
      const Right(unit);

  @override
  Future<Either<Failure, FaceTemplate?>> getTemplate() async =>
      Right(_template);

  @override
  Future<Either<Failure, FaceMatchResult>> verify(
    List<double> probe, {
    double threshold = 0.5,
  }) async => const Right(FaceMatchResult(1, passed: true));
}

class _FakeFacePhotoStore implements FacePhotoStore {
  _FakeFacePhotoStore({this.path});

  final String? path;

  @override
  Future<String?> currentPath() async => path;

  @override
  Future<String?> saveRgb(Uint8List rgbBytes, {required int size}) async =>
      path;
}

const _session = AuthSession(
  token: 'demo-jwt',
  workerId: 'W-1042',
  name: 'Sardor Karimov',
  position: 'Kommunal xizmat mutaxassisi',
  region: 'Toshkent shahri',
  district: "Mirzo Ulug'bek",
);

void main() {
  late AuthCubit authCubit;
  late LocaleCubit localeCubit;
  late ThemeCubit themeCubit;

  setUpAll(() {
    registerFallbackValue(const VerifyOtpParams(phone: '', code: ''));
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});

    final verifyOtp = _MockVerifyOtp();
    when(() => verifyOtp(any())).thenAnswer((_) async => const Right(_session));
    authCubit = AuthCubit(
      sendOtp: _MockSendOtp(),
      verifyOtp: verifyOtp,
      loginEmployee: _MockLoginEmployee(),
      restoreSession: _MockRestoreSession(),
    );
    // Haqiqiy ommaviy API orqali "authenticated + session" holatiga
    // o'tkaziladi — `Cubit.emit()` (protected) tashqaridan chaqirilmaydi
    // (`home_page_test.dart` bilan bir xil naqsh).
    await authCubit.verifyOtp('+998901234567', '1111');

    // `LocaleCubit`/`ThemeCubit` — HAQIQIY (mock/fake emas) instansiyalar:
    // konstruktorlari sinxron va `SharedPreferences.setMockInitialValues`
    // tufayli `setLocale`/`setMode` ham xavfsiz ishlaydi (haqiqiy plagin
    // talab qilinmaydi) — qarang: `locale_cubit_test.dart`/
    // `theme_cubit_test.dart`.
    localeCubit = LocaleCubit();
    themeCubit = ThemeCubit();
  });

  tearDown(() {
    authCubit.close();
    localeCubit.close();
    themeCubit.close();
  });

  /// Ilova ildizidagi `WorkerApp`ning til/mavzu ulanishini takrorlaydi:
  /// `MaterialApp.router`ning `locale`/`themeMode`si to'g'ridan-to'g'ri
  /// cubit holatidan o'qiladi — shuning uchun tilni almashtirish HAQIQATAN
  /// HAM butun ekranni qayta mahalliylashtiradi (`app.dart` bilan bir xil
  /// naqsh).
  Future<void> pumpProfilePage(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (context, _) => const ProfilePage()),
        GoRoute(
          path: '/login',
          builder: (context, _) => const Scaffold(body: Text('login-page')),
        ),
      ],
    );

    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<AuthCubit>.value(value: authCubit),
          BlocProvider<LocaleCubit>.value(value: localeCubit),
          BlocProvider<ThemeCubit>.value(value: themeCubit),
        ],
        child: Builder(
          builder: (context) {
            final locale = context.watch<LocaleCubit>().state;
            final mode = context.watch<ThemeCubit>().state;
            return MaterialApp.router(
              locale: locale,
              theme: AppTheme.light,
              darkTheme: AppTheme.dark,
              themeMode: mode,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              routerConfig: router,
            );
          },
        ),
      ),
    );
    // Kirish animatsiyalari (`flutter_animate` fadeIn/slideY) chekli —
    // `pumpAndSettle()` ISHLATILMAYDI (`home_page_test.dart`dagi kabi
    // konvensiya), bitta chegaralangan pump bilan soatni yetarlicha
    // suramiz.
    await tester.pump(const Duration(seconds: 1));
  }

  group('ProfilePage', () {
    testWidgets('renders the profile header with session details', (
      tester,
    ) async {
      await pumpProfilePage(tester);

      expect(find.textContaining('Sardor Karimov'), findsOneWidget);
      expect(
        find.textContaining('Kommunal xizmat mutaxassisi'),
        findsOneWidget,
      );
      // Region (viloyat/shahar) endi ATAYLAB ko'rsatilmaydi (loyiha faqat
      // Mirzo Ulug'bek uchun) — tuman ko'rsatiladi.
      expect(find.textContaining('Toshkent shahri'), findsNothing);
      expect(find.textContaining("Mirzo Ulug'bek"), findsWidgets);
      expect(find.textContaining('W-1042'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders the language and theme segmented controls', (
      tester,
    ) async {
      await pumpProfilePage(tester);

      expect(find.byType(AppSegmented<Locale>), findsOneWidget);
      expect(find.byType(AppSegmented<ThemeMode>), findsOneWidget);
      expect(find.text("O'zbek"), findsOneWidget);
      expect(find.text('Русский'), findsOneWidget);
    });

    testWidgets(
      'tapping Русский calls LocaleCubit.setLocale and relocalizes the '
      'screen live',
      (tester) async {
        await pumpProfilePage(tester);
        expect(find.text('Til'), findsOneWidget);

        await tester.tap(find.text('Русский'));
        await tester.pump();
        await tester.pump(const Duration(seconds: 1));

        expect(localeCubit.state, const Locale('ru'));
        // Bo'lim sarlavhasi ham qayta chizilgan — real relokalizatsiya,
        // faqat holat o'zgarishi emas.
        expect(find.text('Язык'), findsOneWidget);
        expect(find.text('Til'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('tapping the dark option calls ThemeCubit.setMode(dark)', (
      tester,
    ) async {
      await pumpProfilePage(tester);

      await tester.tap(find.text("Qorong'i"));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(themeCubit.state, ThemeMode.dark);
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows the mock work-info and app-version rows', (
      tester,
    ) async {
      await pumpProfilePage(tester);

      expect(find.text('09:00–18:00'), findsOneWidget);
      expect(find.text('4.8'), findsOneWidget);
      // "Ilova haqida" kartasi sahifaning quyi qismida — dastlabki
      // build/cache extentidan tashqarida, shuning uchun ko'ringuncha
      // pastga suriladi (`ListView` uzun bo'lgani uchun bu qism darhol
      // qurilmagan bo'lishi mumkin).
      await tester.scrollUntilVisible(find.text('v1.0.0'), 300);
      // Skroll paytida yangi qurilgan kartalarning kirish
      // animatsiyalari (`flutter_animate` `delay`li fadeIn) ishga
      // tushadi — test tugashidan oldin ularning tugashini kutamiz,
      // aks holda "Timer is still pending" xatosi chiqadi.
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('v1.0.0'), findsOneWidget);
    });

    testWidgets(
      'tapping Chiqish is guarded (never throws) and navigates to /login',
      (tester) async {
        await pumpProfilePage(tester);

        // "Chiqish" tugmasi sahifa oxirida — topilguncha pastga suriladi
        // (yuqoridagi izohga qarang, shu jumladan animatsiya-timer sababi).
        await tester.scrollUntilVisible(find.text('Chiqish'), 300);
        await tester.pump(const Duration(seconds: 1));

        await tester.tap(find.text('Chiqish'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 600));

        // Chiqish endi tasdiqlash modalini ochadi — "Ha, chiqish" bosilmaguncha
        // navigatsiya bo'lmaydi (tasodifiy chiqib ketishning oldini oladi).
        expect(find.text('Ha, chiqish'), findsOneWidget);
        await tester.tap(find.text('Ha, chiqish'));
        await tester.pump();
        await tester.pump(const Duration(seconds: 1));

        expect(tester.takeException(), isNull);
        expect(find.text('login-page'), findsOneWidget);
      },
    );
  });

  group('ProfilePage face photo + enrollment date', () {
    Future<void> registerFakes({
      FaceTemplate? template,
      String? photoPath,
    }) async {
      if (getIt.isRegistered<FaceRepository>()) {
        await getIt.unregister<FaceRepository>();
      }
      getIt.registerSingleton<FaceRepository>(_FakeFaceRepository(template));
      if (getIt.isRegistered<FacePhotoStore>()) {
        await getIt.unregister<FacePhotoStore>();
      }
      getIt.registerSingleton<FacePhotoStore>(
        _FakeFacePhotoStore(path: photoPath),
      );
    }

    tearDown(() async {
      if (getIt.isRegistered<FaceRepository>()) {
        await getIt.unregister<FaceRepository>();
      }
      if (getIt.isRegistered<FacePhotoStore>()) {
        await getIt.unregister<FacePhotoStore>();
      }
    });

    testWidgets(
      'with no enrolled template: initials AppAvatar and no enrollment date',
      (tester) async {
        await registerFakes();
        await pumpProfilePage(tester);

        expect(find.byType(AppAvatar), findsOneWidget);
        expect(find.byType(Image), findsNothing);
        expect(find.textContaining("Ro'yxatdan o'tilgan"), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'with a template but no saved photo: shows the localized enrollment '
      'date and falls back to the initials avatar',
      (tester) async {
        await registerFakes(
          template: FaceTemplate(
            embedding: const [0.1, 0.2],
            enrolledAt: DateTime(2026, 6, 12),
            workerId: 'W-1042',
          ),
        );
        await pumpProfilePage(tester);

        expect(
          find.textContaining("Ro'yxatdan o'tilgan: 12 Iyn 2026"),
          findsOneWidget,
        );
        expect(find.byType(AppAvatar), findsOneWidget);
        expect(find.byType(Image), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );

    // NOTE: rendering a real `Image.file` in a widget test hangs the harness
    // (real file decode never completes under fake-async), so the "photo is
    // shown" path is covered by code review + the `FacePhotoStore` unit test;
    // the widget test only asserts the initials fallback + date line.
  });
}
