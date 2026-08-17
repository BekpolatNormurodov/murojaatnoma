import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/app/router/redirect_policy.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

/// `resolveAuthRedirect` — GoRouter/BuildContext'siz sof funksiya — bu
/// Vazifa 18ning ENG xavfli qismi (auth/face-enrollment holatiga qarab
/// splash→login→otp→face→home oqimini boshqaradi). Bu fayl to'liq
/// (auth holati × joriy manzil) matritsasini, shu jumladan "har bir
/// redirect natijasi qayta baholanganda barqarorlashadi (loop yo'q)"
/// xususiyatini tekshiradi.
void main() {
  group(resolveAuthRedirect, () {
    const unauth = AuthState();
    const authNoFace = AuthState(
      status: AuthStatus.authenticated,
    );
    const authFace = AuthState(
      status: AuthStatus.authenticated,
      faceEnrolled: true,
    );

    const allLocations = [
      '/splash',
      '/login',
      '/otp',
      '/home',
      '/requests',
      '/chat',
      '/map',
      '/profile',
      '/face/enroll',
      '/face/checkin',
    ];

    test('/splash is never auto-redirected, for any auth state', () {
      for (final state in [unauth, authNoFace, authFace]) {
        expect(
          resolveAuthRedirect(authState: state, location: '/splash'),
          isNull,
          reason: 'state=$state should not redirect away from /splash',
        );
      }
    });

    group('unauthenticated', () {
      test('allows /login and /otp (auth flow in progress)', () {
        expect(
          resolveAuthRedirect(authState: unauth, location: '/login'),
          isNull,
        );
        expect(
          resolveAuthRedirect(authState: unauth, location: '/otp'),
          isNull,
        );
      });

      test('redirects every protected route to /login', () {
        const protectedLocations = [
          '/home',
          '/requests',
          '/chat',
          '/map',
          '/profile',
          '/face/enroll',
          '/face/checkin',
        ];
        for (final loc in protectedLocations) {
          expect(
            resolveAuthRedirect(authState: unauth, location: loc),
            '/login',
            reason: 'unauthenticated + $loc should redirect to /login',
          );
        }
      });
    });

    group('authenticated, face not enrolled', () {
      test('allows /face/enroll', () {
        expect(
          resolveAuthRedirect(authState: authNoFace, location: '/face/enroll'),
          isNull,
        );
      });

      test(
        'redirects everything else (incl. /login, /home, /face/checkin) '
        'to /face/enroll',
        () {
          const otherLocations = [
            '/splash', // handled separately above, but included for parity
            '/login',
            '/otp',
            '/home',
            '/requests',
            '/chat',
            '/map',
            '/profile',
            '/face/checkin',
          ];
          for (final loc in otherLocations) {
            if (loc == '/splash') continue; // splash never redirects
            expect(
              resolveAuthRedirect(authState: authNoFace, location: loc),
              '/face/enroll',
              reason: 'authenticated+!faceEnrolled + $loc -> /face/enroll',
            );
          }
        },
      );
    });

    group('authenticated + face enrolled', () {
      test('sends /login and /otp back to /home', () {
        expect(
          resolveAuthRedirect(authState: authFace, location: '/login'),
          '/home',
        );
        expect(
          resolveAuthRedirect(authState: authFace, location: '/otp'),
          '/home',
        );
      });

      test(
        'allows /home, every shell tab, /face/checkin and /face/enroll',
        () {
          const allowedLocations = [
            '/home',
            '/requests',
            '/chat',
            '/map',
            '/profile',
            '/face/checkin',
            '/face/enroll',
          ];
          for (final loc in allowedLocations) {
            expect(
              resolveAuthRedirect(authState: authFace, location: loc),
              isNull,
              reason: 'authenticated+faceEnrolled + $loc should stay put',
            );
          }
        },
      );
    });

    test(
      'every (state, location) pair stabilizes in a single hop — '
      'the redirect target, when re-evaluated, always returns null '
      '(this is what guarantees no infinite redirect loop)',
      () {
        for (final state in [unauth, authNoFace, authFace]) {
          for (final loc in allLocations) {
            final first = resolveAuthRedirect(authState: state, location: loc);
            final settledLocation = first ?? loc;
            final second = resolveAuthRedirect(
              authState: state,
              location: settledLocation,
            );
            expect(
              second,
              isNull,
              reason:
                  'state=$state loc=$loc first=$first '
                  'settledLocation=$settledLocation should be stable '
                  'but re-redirected to $second',
            );
          }
        }
      },
    );
  });
}
