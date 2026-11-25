import 'dart:async';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/session/account_data_store.dart';
import 'package:user_app/core/session/logout_service.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/face/domain/entities/face_template.dart';
import 'package:user_app/features/face/domain/repositories/face_repository.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/pin/domain/repositories/pin_repository.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';
import 'package:user_app/injection.dart';

import '../../support/app_harness.dart';

const _a = '+998901111111';
const _b = '+998902222222';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory docs;
  late FakeAuthRepository repository;
  late AuthCubit auth;

  setUp(() async {
    docs = Directory.systemTemp.createTempSync('account_switch');
    repository = await configureTestApp(docs);
    auth = getIt<AuthCubit>();
  });

  tearDown(() async {
    await getIt.reset();
    docs.deleteSync(recursive: true);
  });

  Future<String?> secure(String key) =>
      const FlutterSecureStorage().read(key: key);

  Future<void> onboard(String phone, String name) async {
    await auth.verifyOtp(phone, '000000');
    await getIt<RegistrationRepository>().saveProfile(
      CitizenProfile(fullName: name),
    );
    await getIt<FaceRepository>().enroll(
      FaceTemplate(
        embedding: const [0.1],
        enrolledAt: DateTime(2026),
        ownerId: phone,
      ),
    );
    await getIt<PinRepository>().setPin('1234');
    File('${docs.path}/face/portrait.jpg')
      ..createSync(recursive: true)
      ..writeAsBytesSync([1]);
    final cache = getIt<CacheService>();
    await cache.setJson('requests_cache_v1::ariza::all', <Object>[]);
    await cache.setJson(Utility.cacheKey, <Object>[]);
    await cache.setJson(Payment.cacheKey, <Object>[]);
  }

  Future<void> logout() => getIt<LogoutService>().logout();

  bool anyCitizenCache() => getIt<SharedPreferences>().getKeys().any(
    (k) => AccountDataStore.cachePrefixes.any(k.startsWith),
  );

  test('logout clears every list cache', () async {
    await onboard(_a, 'Aliyev Bekzod');
    expect(anyCitizenCache(), isTrue);

    await logout();

    expect(anyCitizenCache(), isFalse);
    expect(auth.state, const AuthState());
  });

  test('another citizen never gets the previous profile/face/PIN', () async {
    await onboard(_a, 'Aliyev Bekzod');
    await logout();

    await auth.verifyOtp(_b, '000000');

    expect(auth.state.isAuthenticated, isTrue);
    expect(auth.state.registered, isFalse);
    expect(auth.state.faceEnrolled, isFalse);
    expect(auth.state.pinSet, isFalse);
    expect(auth.state.session?.name, _b);
    expect(await secure(AccountDataStore.profileKey), isNull);
    expect(await secure(AccountDataStore.templateKey), isNull);
    expect(await secure(AccountDataStore.pinHashKey), isNull);
    expect(File('${docs.path}/face/portrait.jpg').existsSync(), isFalse);

    // B ilovani qayta ochsa ham A ma'lumoti paydo bo'lmaydi.
    await auth.restore();
    expect(auth.state.registered, isFalse);
  });

  test('the same citizen is restored right after OTP, still locked', () async {
    await onboard(_a, 'Aliyev Bekzod');
    await logout();

    await auth.verifyOtp(_a, '000000');

    expect(auth.state.registered, isTrue);
    expect(auth.state.faceEnrolled, isTrue);
    expect(auth.state.pinSet, isTrue);
    expect(auth.state.pinUnlocked, isFalse);
    expect(auth.state.session?.name, 'Aliyev Bekzod');
  });

  test('forgot PIN removes only the PIN', () async {
    await onboard(_a, 'Aliyev Bekzod');

    await getIt<LogoutService>().logout(forgetPin: true);
    await auth.verifyOtp(_a, '000000');

    expect(auth.state.faceEnrolled, isTrue);
    expect(auth.state.pinSet, isFalse);
  });

  test(
    'forgot PIN keeps the PIN lock until the session is really gone',
    () async {
      await onboard(_a, 'Aliyev Bekzod');
      // Server javobi osilib turibdi — ilova shu payt yopilishi mumkin.
      final gate = Completer<void>();
      repository.logoutGate = gate.future;

      final done = getIt<LogoutService>().logout(forgetPin: true);
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(repository.current, isNotNull);
      expect(await secure(AccountDataStore.pinHashKey), isNotNull);

      gate.complete();
      await done;
      expect(await secure(AccountDataStore.pinHashKey), isNull);
    },
  );

  test(
    'forgot PIN keeps the PIN when the session could not be removed',
    () async {
      await onboard(_a, 'Aliyev Bekzod');
      repository.logoutError = Exception('disk');

      await getIt<LogoutService>().logout(forgetPin: true);

      expect(repository.current, isNotNull);
      expect(await secure(AccountDataStore.pinHashKey), isNotNull);
    },
  );

  test('untagged data of another owner is wiped (old app version)', () async {
    await onboard(_a, 'Aliyev Bekzod');
    await const FlutterSecureStorage().delete(key: AccountDataStore.ownerKey);

    // Eski versiyada B shu ma'lumot ustida qolib ketgan sessiya.
    repository.current = sessionFor(_b);
    await auth.restore();

    expect(auth.state.registered, isFalse);
    expect(await secure(AccountDataStore.pinHashKey), isNull);
  });

  test('untagged data of the signed-in citizen survives the update', () async {
    await onboard(_a, 'Aliyev Bekzod');
    await const FlutterSecureStorage().delete(key: AccountDataStore.ownerKey);

    await auth.restore();

    expect(auth.state.pinSet, isTrue);
    expect(await secure(AccountDataStore.ownerKey), '998901111111');
  });

  test('untagged profile without a face is not given to a new login', () async {
    await getIt<RegistrationRepository>().saveProfile(
      const CitizenProfile(fullName: 'Begona Odam'),
    );

    await auth.verifyOtp(_b, '000000');

    expect(auth.state.registered, isFalse);
    expect(await secure(AccountDataStore.profileKey), isNull);
  });
}
