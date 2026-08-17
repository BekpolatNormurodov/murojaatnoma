import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/app/router/go_router_refresh_stream.dart';
import 'package:user_app/app/router/redirect_policy.dart';
import 'package:user_app/app/shell/user_shell.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/auth/presentation/pages/otp_page.dart';
import 'package:user_app/features/auth/presentation/pages/phone_input_page.dart';
import 'package:user_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:user_app/features/face/presentation/pages/face_enroll_page.dart';
import 'package:user_app/features/home/presentation/bloc/home_cubit.dart';
import 'package:user_app/features/home/presentation/pages/home_page.dart';
import 'package:user_app/features/notifications/presentation/pages/notifications_page.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/presentation/bloc/pay_cubit.dart';
import 'package:user_app/features/payments/presentation/bloc/payment_history_cubit.dart';
import 'package:user_app/features/payments/presentation/bloc/utilities_cubit.dart';
import 'package:user_app/features/payments/presentation/pages/pay_page.dart';
import 'package:user_app/features/payments/presentation/pages/payment_history_page.dart';
import 'package:user_app/features/payments/presentation/pages/payment_receipt_page.dart';
import 'package:user_app/features/payments/presentation/pages/utilities_page.dart';
import 'package:user_app/features/pin/presentation/bloc/pin_cubit.dart';
import 'package:user_app/features/pin/presentation/pages/pin_set_page.dart';
import 'package:user_app/features/pin/presentation/pages/pin_unlock_page.dart';
import 'package:user_app/features/profile/presentation/profile_page.dart';
import 'package:user_app/features/registration/presentation/bloc/registration_cubit.dart';
import 'package:user_app/features/registration/presentation/pages/registration_page.dart';
import 'package:user_app/features/reports/presentation/bloc/reports_cubit.dart';
import 'package:user_app/features/reports/presentation/pages/reports_page.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:user_app/features/requests/presentation/bloc/requests_cubit.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';
import 'package:user_app/features/requests/presentation/pages/request_detail_page.dart';
import 'package:user_app/features/requests/presentation/pages/requests_page.dart';
import 'package:user_app/features/requests/presentation/pages/submit_request_page.dart';
import 'package:user_app/injection.dart';

/// Fuqaro ilovasi routeri.
///
/// `/splash`, `/login` (telefon), `/otp` (SMS kod), `/register` (shaxsiy
/// ma'lumotlar, bir marta), `/face/onboarding` (identity, bir marta),
/// `/pin/set` / `/pin/unlock` (PIN yaratish/qulf) va 4-tabli asosiy qobiq
/// (`UserShell`: Bosh sahifa / To'lovlar / Arizalar / Profil). To'lov
/// (`/pay`, `/payments-history`) va arizalar (`/applications/*`) oqimlari
/// ildiz navigatori ustida ochiladi — pastki navigatsiyani to'liq qoplaydi.
///
/// `worker_app/app/router/app_router.dart` bilan bir xil ustunlarga
/// qurilgan (Faza 3: ro'yxatdan o'tish + yuz-ro'yxatdan o'tkazish + PIN-
/// qulf bosqichlari bilan kengaytirilgan):
/// - **Redirect** — `resolveAuthRedirect` (sof, to'liq unit-testlangan —
///   qarang: `redirect_policy.dart`) auth/ro'yxat/yuz/PIN holatiga qarab
///   splash→login→otp→register→face→pin(set|unlock)→home oqimini VA
///   barcha himoyalangan manzillarni (shell tablari + `/pay`,
///   `/applications/*`, `/reports` kabi ildiz navigatoridagi sahifalar)
///   boshqaradi.
/// - **`refreshListenable`** — `GoRouterRefreshStream` ulangan
///   `AuthCubit.stream`ga: `AuthCubit` holati o'zgarganda (masalan OTP
///   tasdiqlangach, yuz/PIN belgilangach yoki bootstrap paytida saqlangan
///   sessiya tiklangach) GoRouter buni AVTOMATIK biladi va joriy manzil
///   uchun `redirect`ni qayta baholaydi.
class AppRouter {
  AppRouter() {
    // `AuthCubit` `injection.dart`da `registerLazySingleton` — shu tufayli
    // bu yerdagi `getIt<AuthCubit>()` ilova ildizida `BlocProvider` orqali
    // widget daraxtiga beriladigan XUDDI SHU instansiyani qaytaradi
    // (`worker_app`dagi bir xil izohga qarang — factory bo'lganida router
    // hech qachon haqiqiy auth o'zgarishlarini ko'rmagan bo'lardi).
    _refresh = GoRouterRefreshStream(getIt<AuthCubit>().stream);
    _router = GoRouter(
      initialLocation: '/splash',
      refreshListenable: _refresh,
      redirect: (context, state) => resolveAuthRedirect(
        authState: context.read<AuthCubit>().state,
        location: state.matchedLocation,
      ),
      routes: _routes,
    );
  }

  late final GoRouterRefreshStream _refresh;
  late final GoRouter _router;

  static final List<RouteBase> _routes = [
    GoRoute(
      path: '/splash',
      builder: (context, _) => BrandSplash(
        tagline: context.l10n.citizenTagline,
        // Doim shu YAGONA manzilga "urinadi" — HAQIQIY manzil (`/login`
        // yoki `/home`) yuqoridagi `redirect` orqali hal qilinadi
        // (qarang: `resolveAuthRedirect` hujjatidagi splash izohi). Shu
        // tufayli bu yerda `AuthCubit` holatini oldindan o'qishning
        // hojati yo'q.
        onFinished: () => context.go('/home'),
      ),
    ),
    GoRoute(path: '/login', builder: (context, _) => const PhoneInputPage()),
    GoRoute(
      path: '/otp',
      builder: (context, state) => OtpPage(phone: state.extra as String? ?? ''),
    ),

    // ---- Faza 3: ro'yxatdan o'tish (shaxsiy ma'lumotlar) + yuz + PIN-qulf
    // (OTP dan keyin, bosh sahifadan oldin — bir martalik onboarding) ----
    GoRoute(
      path: '/register',
      builder: (context, _) => BlocProvider(
        create: (_) => getIt<RegistrationCubit>(),
        child: const RegistrationPage(),
      ),
    ),
    GoRoute(
      path: '/face/onboarding',
      builder: (context, _) {
        final ownerId = context.read<AuthCubit>().state.session?.userId ?? '';
        return BlocProvider(
          create: (_) => getIt<FaceCubit>(param1: ownerId),
          child: const FaceEnrollPage(),
        );
      },
    ),
    GoRoute(
      path: '/pin/set',
      builder: (context, _) => BlocProvider(
        create: (_) => getIt<PinCubit>(),
        child: const PinSetPage(),
      ),
    ),
    GoRoute(
      path: '/pin/unlock',
      builder: (context, _) => BlocProvider(
        create: (_) => getIt<PinCubit>(),
        child: const PinUnlockPage(),
      ),
    ),

    // ---- To'lov oqimi (ildiz navigatorida — pastki navigatsiyasiz) ----
    GoRoute(
      path: '/pay',
      pageBuilder: (context, state) => _fade(
        BlocProvider(
          create: (_) => getIt<PayCubit>(),
          child: PayPage(utility: state.extra! as Utility),
        ),
        state,
      ),
    ),
    GoRoute(
      path: '/payments-history',
      pageBuilder: (context, state) => _fade(
        BlocProvider(
          create: (_) => getIt<PaymentHistoryCubit>()..load(),
          child: const PaymentHistoryPage(),
        ),
        state,
      ),
    ),
    GoRoute(
      path: '/payments-history/receipt',
      pageBuilder: (context, state) =>
          _fade(PaymentReceiptPage(payment: state.extra! as Payment), state),
    ),

    // ---- Arizalar/shikoyatlar oqimi (ildiz navigatorida) ----
    // Statik `/applications/submit` DINAMIK `/applications/:id`dan
    // OLDIN turadi — go_router bir xil segmentni ikkalasi bilan ham
    // moslashtira olishi mumkin bo'lgan holatlarda birinchi mos
    // keluvchini tanlaydi.
    GoRoute(
      path: '/applications/submit',
      pageBuilder: (context, state) => _fade(
        BlocProvider(
          create: (_) => getIt<SubmitRequestCubit>(),
          child: const SubmitRequestPage(),
        ),
        state,
      ),
    ),
    GoRoute(
      path: '/applications/:id',
      pageBuilder: (context, state) {
        final id = state.pathParameters['id']!;
        return _fade(
          BlocProvider(
            create: (_) => getIt<RequestDetailCubit>()..load(id),
            child: const RequestDetailPage(),
          ),
          state,
        );
      },
    ),
    GoRoute(
      path: '/reports',
      pageBuilder: (context, state) => _fade(
        BlocProvider(
          create: (_) => getIt<ReportsCubit>()..load(),
          child: const ReportsPage(),
        ),
        state,
      ),
    ),
    // `/notifications` — bosh sahifadagi qo'ng'iroq belgisidan PUSH
    // qilinadigan to'liq ekranli sahifa (`/reports` bilan bir xil naqsh):
    // ildiz navigatorida. `NotificationsCubit` LAZY SINGLETON (ilova
    // ildizida allaqachon `BlocProvider` orqali ta'minlangan — qarang:
    // `app.dart`), shuning uchun bu yerda qo'shimcha `BlocProvider` shart
    // emas.
    GoRoute(
      path: '/notifications',
      pageBuilder: (context, state) =>
          _fade(const NotificationsPage(), state),
    ),

    // ---- Asosiy qobiq (pastki navigatsiya) ----
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => UserShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              builder: (context, _) => BlocProvider(
                create: (_) => getIt<HomeCubit>()..load(),
                child: const HomePage(),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/kommunalka',
              builder: (context, _) => BlocProvider(
                create: (_) => getIt<UtilitiesCubit>()..load(),
                child: const UtilitiesPage(),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/applications',
              builder: (context, _) => BlocProvider(
                create: (_) =>
                    getIt<RequestsCubit>()..load(kind: RequestKind.ariza),
                child: const RequestsPage(),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/profile',
              builder: (context, _) => const ProfilePage(),
            ),
          ],
        ),
      ],
    ),
  ];

  /// `MaterialApp.router` uchun router konfiguratsiyasi.
  GoRouter get config => _router;
}

/// Silliq (fade + subtle slide) o'tish animatsiyasi bilan sahifa — to'lov/
/// arizalar oqimidagi ildiz-navigator sahifalari uchun.
CustomTransitionPage<void> _fade(Widget child, GoRouterState state) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 280),
    transitionsBuilder: (context, animation, _, child) {
      return FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, 0.03), end: Offset.zero)
              .animate(
                CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
              ),
          child: child,
        ),
      );
    },
  );
}
