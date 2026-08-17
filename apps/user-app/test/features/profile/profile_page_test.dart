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
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/usecases/restore_session.dart';
import 'package:user_app/features/auth/domain/usecases/send_otp.dart';
import 'package:user_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/data/services/face_photo_store.dart';
import 'package:user_app/features/face/domain/entities/face_template.dart';
import 'package:user_app/features/face/domain/repositories/face_repository.dart';
import 'package:user_app/features/profile/presentation/profile_page.dart';
import 'package:user_app/injection.dart';

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockRestoreSession extends Mock implements RestoreSession {}

const _session = AuthSession(
  token: 'demo-jwt',
  userId: 'U-2087',
  name: 'Aziz Rahimov',
  phone: '+998901234567',
  region: 'Chilonzor tumani',
);

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

void main() {
  late AuthCubit authCubit;
  late LocaleCubit localeCubit;
  late ThemeCubit themeCubit;

  setUpAll(() {
    registerFallbackValue(const VerifyOtpParams(phone: '', code: ''));
  });

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

  setUp(() async {
    SharedPreferences.setMockInitialValues({});

    final verifyOtp = _MockVerifyOtp();
    when(() => verifyOtp(any())).thenAnswer((_) async => const Right(_session));
    authCubit = AuthCubit(
      sendOtp: _MockSendOtp(),
      verifyOtp: verifyOtp,
      restoreSession: _MockRestoreSession(),
    );
    await authCubit.verifyOtp('+998901234567', '1111');

    localeCubit = LocaleCubit();
    themeCubit = ThemeCubit();
  });

  tearDown(() async {
    await authCubit.close();
    await localeCubit.close();
    await themeCubit.close();
    await getIt.reset();
  });

  Future<void> pumpProfilePage(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (context, _) => const ProfilePage()),
        GoRoute(
          path: '/login',
          builder: (context, _) => const Scaffold(body: Text('login-page')),
        ),
        GoRoute(
          path: '/reports',
          builder: (context, _) => const Scaffold(body: Text('reports-page')),
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
    await tester.pump(const Duration(seconds: 1));
  }

  group('ProfilePage face photo + enrollment date', () {
    testWidgets(
      'with no enrolled template: shows the initials AppAvatar and no '
      'enrollment-date line',
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
            ownerId: 'U-2087',
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
    // shown" path is covered by code review + the `FacePhotoStore` unit test
    // (which proves the JPG file + path); the widget test only asserts the
    // initials fallback + date line, per the "best-effort photo" scope.
  });
}
