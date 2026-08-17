import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/app/router/redirect_policy.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';

/// `resolveAuthRedirect` — GoRouter/BuildContext'siz sof funksiya — Faza 3
/// to'liq oqimini boshqaradi:
/// splash→login→otp→register→face→pin(set|unlock)→home VA barcha
/// himoyalangan manzillarni. Bu fayl to'liq (holat × joriy manzil)
/// matritsasini, shu jumladan "har bir redirect natijasi qayta
/// baholanganda barqarorlashadi (loop yo'q)" xususiyatini tekshiradi —
/// `worker_app/test/app/router/redirect_policy_test.dart` bilan bir xil
/// naqsh, ro'yxatdan o'tish (`/register`) VA PIN-qulf bosqichlari bilan
/// kengaytirilgan.
///
/// Eslatma: auto-login (sessiya tiklangan, `73838f6`)ning aynan "qulf"
/// nuqtasi — `authFullyUnlocked` (pastda) HAM bir xil auth/register/face/
/// pin bayroqlariga ega, FAQAT `pinUnlocked=false` — bu SAVOL EMAS, bu
/// aynan sovuq ishga tushirishning o'zi: pastdagi
/// `'a restored session (auth+face+pin already true, but the fresh '
/// 'session hasn't unlocked yet) always lands on /pin/unlock'` guruhi
/// buni to'g'ridan-to'g'ri tekshiradi.
void main() {
  group(resolveAuthRedirect, () {
    const unauth = AuthState();
    const authNotRegistered = AuthState(status: AuthStatus.authenticated);
    const authRegisteredNoFace = AuthState(
      status: AuthStatus.authenticated,
      registered: true,
    );
    const authFaceNoPin = AuthState(
      status: AuthStatus.authenticated,
      registered: true,
      faceEnrolled: true,
    );
    const authFacePinLocked = AuthState(
      status: AuthStatus.authenticated,
      registered: true,
      faceEnrolled: true,
      pinSet: true,
    );
    const authFullyUnlocked = AuthState(
      status: AuthStatus.authenticated,
      registered: true,
      faceEnrolled: true,
      pinSet: true,
      pinUnlocked: true,
    );

    const allLocations = [
      '/splash',
      '/login',
      '/otp',
      '/register',
      '/face/onboarding',
      '/pin/set',
      '/pin/unlock',
      '/home',
      '/kommunalka',
      '/applications',
      '/profile',
      '/pay',
      '/payments-history',
      '/applications/submit',
      '/reports',
    ];

    test('/splash is never auto-redirected, for any state', () {
      for (final state in [
        unauth,
        authNotRegistered,
        authRegisteredNoFace,
        authFaceNoPin,
        authFacePinLocked,
        authFullyUnlocked,
      ]) {
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
          '/register',
          '/face/onboarding',
          '/pin/set',
          '/pin/unlock',
          '/home',
          '/kommunalka',
          '/applications',
          '/profile',
          '/pay',
          '/payments-history',
          '/applications/submit',
          '/reports',
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

    group('authenticated, not registered', () {
      test('allows /register', () {
        expect(
          resolveAuthRedirect(
            authState: authNotRegistered,
            location: '/register',
          ),
          isNull,
        );
      });

      test(
        'redirects everything else (incl. /login, /face/onboarding, '
        '/pin/set, /pin/unlock, /home) to /register — registration is the '
        'FIRST gate after auth, before face/PIN',
        () {
          const otherLocations = [
            '/login',
            '/otp',
            '/face/onboarding',
            '/pin/set',
            '/pin/unlock',
            '/home',
            '/kommunalka',
            '/applications',
            '/profile',
            '/pay',
            '/payments-history',
            '/applications/submit',
            '/reports',
          ];
          for (final loc in otherLocations) {
            expect(
              resolveAuthRedirect(authState: authNotRegistered, location: loc),
              '/register',
              reason: 'authenticated+!registered + $loc -> /register',
            );
          }
        },
      );
    });

    group('authenticated + registered, face not enrolled', () {
      test('allows /face/onboarding', () {
        expect(
          resolveAuthRedirect(
            authState: authRegisteredNoFace,
            location: '/face/onboarding',
          ),
          isNull,
        );
      });

      test(
        'redirects everything else (incl. /login, /register, /pin/set, '
        '/pin/unlock, /home) to /face/onboarding',
        () {
          const otherLocations = [
            '/login',
            '/otp',
            '/register',
            '/pin/set',
            '/pin/unlock',
            '/home',
            '/kommunalka',
            '/applications',
            '/profile',
          ];
          for (final loc in otherLocations) {
            expect(
              resolveAuthRedirect(
                authState: authRegisteredNoFace,
                location: loc,
              ),
              '/face/onboarding',
              reason:
                  'authenticated+registered+!faceEnrolled + $loc -> '
                  '/face/onboarding',
            );
          }
        },
      );
    });

    group('authenticated + face enrolled, PIN not set', () {
      test('allows /pin/set', () {
        expect(
          resolveAuthRedirect(authState: authFaceNoPin, location: '/pin/set'),
          isNull,
        );
      });

      test(
        'redirects everything else (incl. /login, /register, '
        '/face/onboarding, /pin/unlock, /home) to /pin/set',
        () {
          const otherLocations = [
            '/login',
            '/otp',
            '/register',
            '/face/onboarding',
            '/pin/unlock',
            '/home',
            '/kommunalka',
            '/applications',
            '/profile',
          ];
          for (final loc in otherLocations) {
            expect(
              resolveAuthRedirect(authState: authFaceNoPin, location: loc),
              '/pin/set',
              reason: 'authenticated+faceEnrolled+!pinSet + $loc -> /pin/set',
            );
          }
        },
      );
    });

    group(
      'authenticated + face enrolled + PIN set, but NOT unlocked this '
      'session (== the auto-login cold-start "lock screen" case)',
      () {
        test('allows /pin/unlock', () {
          expect(
            resolveAuthRedirect(
              authState: authFacePinLocked,
              location: '/pin/unlock',
            ),
            isNull,
          );
        });

        test(
          'a restored session (auth+face+pin already true, but the fresh '
          "session hasn't unlocked yet) always lands on /pin/unlock — "
          'NEVER back on /login or /face/onboarding, and NEVER straight '
          'through to /home (this is the actual app-lock, must not be '
          'bypassable by a stale deep link)',
          () {
            const otherLocations = [
              '/login',
              '/otp',
              '/register',
              '/face/onboarding',
              '/pin/set',
              '/home',
              '/kommunalka',
              '/applications',
              '/profile',
              '/pay',
              '/payments-history',
              '/applications/submit',
              '/reports',
            ];
            for (final loc in otherLocations) {
              expect(
                resolveAuthRedirect(
                  authState: authFacePinLocked,
                  location: loc,
                ),
                '/pin/unlock',
                reason:
                    'authenticated+faceEnrolled+pinSet+!pinUnlocked + $loc '
                    '-> /pin/unlock',
              );
            }
          },
        );
      },
    );

    group('fully unlocked (auth + face + pin + session unlocked)', () {
      test('sends /login and /otp back to /home', () {
        expect(
          resolveAuthRedirect(authState: authFullyUnlocked, location: '/login'),
          '/home',
        );
        expect(
          resolveAuthRedirect(authState: authFullyUnlocked, location: '/otp'),
          '/home',
        );
      });

      test(
        'allows /home, every other protected location, AND (deliberately '
        'not forced away from — e.g. a future "edit profile"/"change PIN" '
        'entry point) /register, /face/onboarding, /pin/set, /pin/unlock',
        () {
          const allowedLocations = [
            '/home',
            '/kommunalka',
            '/applications',
            '/profile',
            '/pay',
            '/payments-history',
            '/applications/submit',
            '/reports',
            '/register',
            '/face/onboarding',
            '/pin/set',
            '/pin/unlock',
          ];
          for (final loc in allowedLocations) {
            expect(
              resolveAuthRedirect(authState: authFullyUnlocked, location: loc),
              isNull,
              reason: 'fully unlocked + $loc should stay put',
            );
          }
        },
      );
    });

    test(
      'every (state, location) pair stabilizes in a single hop — the '
      'redirect target, when re-evaluated, always returns null (this is '
      'what guarantees no infinite redirect loop and no blank screen)',
      () {
        for (final state in [
          unauth,
          authNotRegistered,
          authRegisteredNoFace,
          authFaceNoPin,
          authFacePinLocked,
          authFullyUnlocked,
        ]) {
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

    test(
      'defensive: "impossible" flag combinations (faceEnrolled without '
      'registered, pinSet without faceEnrolled, pinUnlocked without '
      'pinSet) still resolve to exactly one sane destination and '
      'stabilize — the policy never crashes or loops even if a caller '
      'manages to reach an unreachable-in-practice state',
      () {
        const weirdStates = [
          // faceEnrolled=true but registered=false (never produced by the
          // app, /face/onboarding is only reachable once registered=true).
          AuthState(status: AuthStatus.authenticated, faceEnrolled: true),
          // pinSet=true but faceEnrolled=false (never produced by the app,
          // markPinSet()/markPinAlreadySet() require faceEnrolled first) —
          // registered=true here so this isolates the face/pin dimension.
          AuthState(
            status: AuthStatus.authenticated,
            registered: true,
            pinSet: true,
          ),
          // pinUnlocked=true but pinSet=false (never produced by the app).
          AuthState(
            status: AuthStatus.authenticated,
            registered: true,
            pinUnlocked: true,
          ),
          AuthState(
            status: AuthStatus.authenticated,
            registered: true,
            faceEnrolled: true,
            pinUnlocked: true,
          ),
        ];
        for (final state in weirdStates) {
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
              reason: 'state=$state loc=$loc should still stabilize',
            );
          }
        }
      },
    );
  });
}
