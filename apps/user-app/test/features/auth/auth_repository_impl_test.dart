import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:user_app/features/auth/data/models/auth_session_model.dart';
import 'package:user_app/features/auth/data/repositories/auth_repository_impl.dart';

class _MockAuthRemoteDataSource extends Mock implements AuthRemoteDataSource {}

void main() {
  group(AuthRepositoryImpl, () {
    late AuthRemoteDataSource remote;
    late SharedPreferences prefs;
    late AuthRepositoryImpl subject;

    setUp(() async {
      remote = _MockAuthRemoteDataSource();
      SharedPreferences.setMockInitialValues({
        AuthInterceptor.tokenKey: 'stale-jwt-token',
        'user_session': '{"token":"stale-jwt-token"}',
      });
      prefs = await SharedPreferences.getInstance();
      subject = AuthRepositoryImpl(remote: remote, prefs: prefs);
    });

    group('logout', () {
      test(
        'removes both the auth token and the persisted user session',
        () async {
          // Sanity check: both keys are seeded before logout() runs.
          expect(prefs.getString(AuthInterceptor.tokenKey), isNotNull);
          expect(prefs.getString('user_session'), isNotNull);

          await subject.logout();

          expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
          expect(prefs.getString('user_session'), isNull);
        },
      );
    });

    group('currentSession', () {
      test('no persisted session -> null', () async {
        // Fresh prefs (no 'user_session'/token seeded) — a cold start
        // before the user has ever logged in.
        SharedPreferences.setMockInitialValues({});
        prefs = await SharedPreferences.getInstance();
        subject = AuthRepositoryImpl(remote: remote, prefs: prefs);

        expect(await subject.currentSession(), isNull);
      });

      test('full round-trip: verifyOtp() persists the token+session, '
          'currentSession() reads it back (this is what bootstrap and '
          'AuthCubit.restore() rely on for auto-login), and logout() '
          'clears it so a later currentSession() is null again - proving '
          'the token is genuinely saved AND restore-able AND logout '
          'genuinely logs out', () async {
        SharedPreferences.setMockInitialValues({});
        prefs = await SharedPreferences.getInstance();
        subject = AuthRepositoryImpl(remote: remote, prefs: prefs);

        const session = AuthSessionModel(
          token: 'fresh-jwt-456',
          userId: 'U-3007',
          name: 'Aziza Rahimova',
          phone: '901234567',
          region: 'Yashnobod tumani',
        );
        when(
          () => remote.verifyOtp(phone: '901234567', code: '1111'),
        ).thenAnswer((_) async => session);

        final verifyResult = await subject.verifyOtp(
          phone: '901234567',
          code: '1111',
        );
        expect(verifyResult.isRight(), isTrue);

        // Persisted for AuthInterceptor (every future request's Bearer
        // token) AND as the full session JSON.
        expect(prefs.getString(AuthInterceptor.tokenKey), 'fresh-jwt-456');

        // A brand new AuthRepositoryImpl instance (simulating a fresh app
        // launch reading the SAME underlying SharedPreferences) must
        // restore the exact same session — this is the auto-login path.
        final restored = AuthRepositoryImpl(remote: remote, prefs: prefs);
        final currentSession = await restored.currentSession();
        expect(currentSession, session);

        await restored.logout();

        expect(await restored.currentSession(), isNull);
        expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
      });
    });
    group('currentSession without an access token', () {
      test('a saved session with no token is cleared and null is '
          'returned (an expired session must not restore a '
          'half-logged-in state)', () async {
        SharedPreferences.setMockInitialValues({
          'user_session':
              '{"token":"old","userId":"U-1","name":"A",'
              '"phone":"9","region":"R"}',
          'refresh_token': 'legacy-refresh',
        });
        prefs = await SharedPreferences.getInstance();
        subject = AuthRepositoryImpl(remote: remote, prefs: prefs);

        expect(await subject.currentSession(), isNull);
        expect(prefs.getString('user_session'), isNull);
        expect(prefs.getString('refresh_token'), isNull);
      });
    });

    group('server and network errors keep their message', () {
      test(
        'sendOtp: ServerException -> ServerFailure with server text',
        () async {
          when(
            () => remote.sendOtp(any()),
          ).thenThrow(ServerException("Juda ko'p urinish"));

          final result = await subject.sendOtp('901234567');

          expect(
            result,
            const Left<Failure, Unit>(ServerFailure("Juda ko'p urinish")),
          );
        },
      );

      test('sendOtp: NetworkException -> NetworkFailure', () async {
        when(
          () => remote.sendOtp(any()),
        ).thenThrow(NetworkException('Server yetib bo`lmadi'));

        final result = await subject.sendOtp('901234567');

        expect(
          result,
          const Left<Failure, Unit>(NetworkFailure('Server yetib bo`lmadi')),
        );
      });

      test('verifyOtp: ServerException -> ServerFailure with server text, '
          'nothing is persisted', () async {
        SharedPreferences.setMockInitialValues({});
        prefs = await SharedPreferences.getInstance();
        subject = AuthRepositoryImpl(remote: remote, prefs: prefs);
        when(
          () => remote.verifyOtp(
            phone: any(named: 'phone'),
            code: any(named: 'code'),
          ),
        ).thenThrow(ServerException("Kod noto'g'ri"));

        final result = await subject.verifyOtp(
          phone: '901234567',
          code: '000000',
        );

        expect(
          result.fold((f) => f, (_) => null),
          const ServerFailure("Kod noto'g'ri"),
        );
        expect(prefs.getString(AuthInterceptor.tokenKey), isNull);
        expect(prefs.getString('user_session'), isNull);
      });

      test('verifyOtp: NetworkException -> NetworkFailure', () async {
        when(
          () => remote.verifyOtp(
            phone: any(named: 'phone'),
            code: any(named: 'code'),
          ),
        ).thenThrow(NetworkException('Ulanish uzildi'));

        final result = await subject.verifyOtp(
          phone: '901234567',
          code: '000000',
        );

        expect(
          result.fold((f) => f, (_) => null),
          const NetworkFailure('Ulanish uzildi'),
        );
      });
    });
  });
}
