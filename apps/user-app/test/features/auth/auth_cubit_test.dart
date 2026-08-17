import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/usecases/restore_session.dart';
import 'package:user_app/features/auth/domain/usecases/send_otp.dart';
import 'package:user_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';

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
      userId: 'U-2087',
      name: 'Dilnoza Yusupova',
      phone: phone,
      region: 'Mirzo Ulug‘bek tumani',
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
        verify: (_) {
          verify(() => sendOtp(const SendOtpParams(phone))).called(1);
        },
      );
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
        '(the exact scenario that must stop a returning citizen from '
        'being bounced back to /login)',
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

    group('Faza 3: registration + face + PIN flags', () {
      blocTest<AuthCubit, AuthState>(
        'markRegistered sets registered=true and leaves face/PIN flags '
        'untouched (the citizen still has to complete /face/onboarding '
        'and /pin/set afterwards)',
        build: buildCubit,
        seed: () =>
            const AuthState(status: AuthStatus.authenticated, session: session),
        act: (c) => c.markRegistered(),
        expect: () => [
          isA<AuthState>()
              .having((s) => s.registered, 'registered', isTrue)
              .having((s) => s.faceEnrolled, 'faceEnrolled', isFalse)
              .having((s) => s.pinSet, 'pinSet', isFalse)
              .having((s) => s.pinUnlocked, 'pinUnlocked', isFalse),
        ],
      );

      blocTest<AuthCubit, AuthState>(
        'markFaceEnrolled sets faceEnrolled=true and leaves registered/PIN '
        'flags untouched',
        build: buildCubit,
        seed: () => const AuthState(
          status: AuthStatus.authenticated,
          session: session,
          registered: true,
        ),
        act: (c) => c.markFaceEnrolled(),
        expect: () => [
          isA<AuthState>()
              .having((s) => s.registered, 'registered', isTrue)
              .having((s) => s.faceEnrolled, 'faceEnrolled', isTrue)
              .having((s) => s.pinSet, 'pinSet', isFalse)
              .having((s) => s.pinUnlocked, 'pinUnlocked', isFalse),
        ],
      );

      blocTest<AuthCubit, AuthState>(
        'markPinSet (first-time creation, /pin/set) sets BOTH pinSet AND '
        'pinUnlocked — the citizen just proved they know it, so no '
        'separate /pin/unlock step is required this session',
        build: buildCubit,
        seed: () => const AuthState(
          status: AuthStatus.authenticated,
          session: session,
          registered: true,
          faceEnrolled: true,
        ),
        act: (c) => c.markPinSet(),
        expect: () => [
          isA<AuthState>()
              .having((s) => s.pinSet, 'pinSet', isTrue)
              .having((s) => s.pinUnlocked, 'pinUnlocked', isTrue),
        ],
      );

      blocTest<AuthCubit, AuthState>(
        'markPinAlreadySet (bootstrap restore) sets ONLY pinSet — '
        'pinUnlocked stays false, so the redirect policy still routes a '
        'cold start through /pin/unlock (the actual app-lock)',
        build: buildCubit,
        seed: () => const AuthState(
          status: AuthStatus.authenticated,
          session: session,
          registered: true,
          faceEnrolled: true,
        ),
        act: (c) => c.markPinAlreadySet(),
        expect: () => [
          isA<AuthState>()
              .having((s) => s.pinSet, 'pinSet', isTrue)
              .having((s) => s.pinUnlocked, 'pinUnlocked', isFalse),
        ],
      );

      blocTest<AuthCubit, AuthState>(
        'markPinUnlocked (/pin/unlock success) sets pinUnlocked=true',
        build: buildCubit,
        seed: () => const AuthState(
          status: AuthStatus.authenticated,
          session: session,
          registered: true,
          faceEnrolled: true,
          pinSet: true,
        ),
        act: (c) => c.markPinUnlocked(),
        expect: () => [
          isA<AuthState>().having(
            (s) => s.pinUnlocked,
            'pinUnlocked',
            isTrue,
          ),
        ],
      );

      blocTest<AuthCubit, AuthState>(
        'reset() also clears registered/faceEnrolled/pinSet/pinUnlocked '
        'back to false (logout must not leave a stale unlock behind)',
        build: buildCubit,
        seed: () => const AuthState(
          status: AuthStatus.authenticated,
          session: session,
          registered: true,
          faceEnrolled: true,
          pinSet: true,
          pinUnlocked: true,
        ),
        act: (c) => c.reset(),
        expect: () => [const AuthState()],
      );
    });
  });
}
