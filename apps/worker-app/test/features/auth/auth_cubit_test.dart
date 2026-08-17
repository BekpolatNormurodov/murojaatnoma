import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

class _MockSendOtp extends Mock implements SendOtp {}

class _MockVerifyOtp extends Mock implements VerifyOtp {}

class _MockRestoreSession extends Mock implements RestoreSession {}

void main() {
  group(AuthCubit, () {
    late SendOtp sendOtp;
    late VerifyOtp verifyOtp;
    late RestoreSession restoreSession;

    const phone = '901234567';
    const session = AuthSession(
      token: 'demo-jwt-123',
      workerId: 'W-1042',
      name: 'Sardor Karimov',
      position: 'Kommunal xizmat mutaxassisi',
      region: 'Chilonzor tumani',
    );

    AuthCubit buildCubit() => AuthCubit(
      sendOtp: sendOtp,
      verifyOtp: verifyOtp,
      restoreSession: restoreSession,
    );

    setUpAll(() {
      registerFallbackValue(const SendOtpParams(phone));
      registerFallbackValue(const VerifyOtpParams(phone: phone, code: '1111'));
      registerFallbackValue(const NoParams());
    });

    setUp(() {
      sendOtp = _MockSendOtp();
      verifyOtp = _MockVerifyOtp();
      restoreSession = _MockRestoreSession();
      // Default: no persisted session — individual tests override this
      // where a restored session matters.
      when(
        () => restoreSession(any()),
      ).thenAnswer((_) async => const Right(null));
    });

    group('verifyOtp', () {
      blocTest<AuthCubit, AuthState>(
        'emits [loading, authenticated] when code is the demo code (1111)',
        setUp: () {
          when(
            () => verifyOtp(any()),
          ).thenAnswer((_) async => const Right(session));
        },
        build: buildCubit,
        act: (c) => c.verifyOtp(phone, '1111'),
        expect: () => [
          isA<AuthState>().having(
            (s) => s.status,
            'status',
            AuthStatus.loading,
          ),
          isA<AuthState>()
              .having((s) => s.status, 'status', AuthStatus.authenticated)
              .having((s) => s.session, 'session', session)
              .having((s) => s.isAuthenticated, 'isAuthenticated', isTrue),
        ],
        verify: (_) {
          verify(
            () => verifyOtp(const VerifyOtpParams(phone: phone, code: '1111')),
          ).called(1);
        },
      );

      blocTest<AuthCubit, AuthState>(
        'emits [loading, error] when code is incorrect',
        setUp: () {
          when(() => verifyOtp(any())).thenAnswer(
            (_) async => const Left(AuthFailure('Kod noto‘g‘ri kiritildi')),
          );
        },
        build: buildCubit,
        act: (c) => c.verifyOtp(phone, '0000'),
        expect: () => [
          isA<AuthState>().having(
            (s) => s.status,
            'status',
            AuthStatus.loading,
          ),
          isA<AuthState>()
              .having((s) => s.status, 'status', AuthStatus.error)
              .having(
                (s) => s.errorMessage,
                'errorMessage',
                'Kod noto‘g‘ri kiritildi',
              ),
        ],
      );
    });

    group('requestOtp', () {
      blocTest<AuthCubit, AuthState>(
        'emits [loading, otpSent] when the SMS is sent successfully',
        setUp: () {
          when(() => sendOtp(any())).thenAnswer((_) async => const Right(unit));
        },
        build: buildCubit,
        act: (c) => c.requestOtp(phone),
        expect: () => [
          isA<AuthState>().having(
            (s) => s.status,
            'status',
            AuthStatus.loading,
          ),
          isA<AuthState>().having(
            (s) => s.status,
            'status',
            AuthStatus.otpSent,
          ),
        ],
      );

      blocTest<AuthCubit, AuthState>(
        'emits [loading, error] when the phone number is invalid',
        setUp: () {
          when(() => sendOtp(any())).thenAnswer(
            (_) async => const Left(AuthFailure('Telefon raqami noto‘g‘ri')),
          );
        },
        build: buildCubit,
        act: (c) => c.requestOtp('123'),
        expect: () => [
          isA<AuthState>().having(
            (s) => s.status,
            'status',
            AuthStatus.loading,
          ),
          isA<AuthState>().having((s) => s.status, 'status', AuthStatus.error),
        ],
      );
    });

    group('reset', () {
      blocTest<AuthCubit, AuthState>(
        'emits the initial state',
        build: buildCubit,
        seed: () =>
            const AuthState(status: AuthStatus.authenticated, session: session),
        act: (c) => c.reset(),
        expect: () => [const AuthState()],
      );
    });

    group('restore (bootstrap auto-login)', () {
      blocTest<AuthCubit, AuthState>(
        'a persisted session -> emits authenticated with that session '
        '(the exact scenario that must stop a returning user from being '
        'bounced back to /login)',
        setUp: () {
          when(
            () => restoreSession(any()),
          ).thenAnswer((_) async => const Right(session));
        },
        build: buildCubit,
        act: (c) => c.restore(),
        expect: () => [
          isA<AuthState>()
              .having((s) => s.status, 'status', AuthStatus.authenticated)
              .having((s) => s.session, 'session', session)
              .having((s) => s.isAuthenticated, 'isAuthenticated', isTrue),
        ],
      );

      blocTest<AuthCubit, AuthState>(
        'no persisted session (never logged in, or logged out) -> stays '
        'in the initial state — no spurious emit',
        setUp: () {
          when(
            () => restoreSession(any()),
          ).thenAnswer((_) async => const Right(null));
        },
        build: buildCubit,
        act: (c) => c.restore(),
        expect: () => <AuthState>[],
        verify: (c) {
          expect(c.state, const AuthState());
          expect(c.state.isAuthenticated, isFalse);
        },
      );

      blocTest<AuthCubit, AuthState>(
        'restoreSession failing -> never throws, stays in the initial '
        'state (restore() is safe to await unconditionally at bootstrap)',
        setUp: () {
          when(() => restoreSession(any())).thenAnswer(
            (_) async => const Left(CacheFailure('storage unavailable')),
          );
        },
        build: buildCubit,
        act: (c) => c.restore(),
        expect: () => <AuthState>[],
      );

      blocTest<AuthCubit, AuthState>(
        'logout (reset) after a restored session, then restoring again '
        'with no session -> stays unauthenticated (logout really logs '
        'out, even across a fresh restore)',
        setUp: () {
          when(
            () => restoreSession(any()),
          ).thenAnswer((_) async => const Right(null));
        },
        build: buildCubit,
        seed: () =>
            const AuthState(status: AuthStatus.authenticated, session: session),
        act: (c) async {
          c.reset();
          await c.restore();
        },
        expect: () => [const AuthState()],
      );
    });
  });
}
