import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';

/// `AuthCubit` "kirgan → chiqqan" holatga o'tganda (qo'lda logout YOKI
/// serverda rad etilgan sessiya — 401, refresh muvaffaqiyatsiz) ISTALGAN
/// ekrandan login sahifasiga toza o'tkazadigan global host:
///
/// 1. root navigatordagi barcha ochiq dialog / bottom sheet / pageless
///    route'larni yopadi (ular barrier'i bilan ekranda osilib qolardi);
/// 2. `router.go('/login')` — GoRouter sahifa stekini butunlay almashtiradi
///    (ichma-ich `/reports/new`, `/chat/:id` va h.k. ham olib tashlanadi;
///    shell branch'lari va ulardagi cubit'lar dispose bo'ladi).
///
/// Router'ning `redirect`i ham `/login`ga yo'naltiradi, lekin u popup
/// route'larni yopmaydi — shuning uchun bu host kerak.
class AuthNavigationHost extends StatelessWidget {
  const AuthNavigationHost({
    required this.router,
    required this.child,
    super.key,
    this.loginLocation = '/login',
  });

  final GoRouter router;
  final Widget child;
  final String loginLocation;

  void _leaveToLogin() {
    final navigator = router.routerDelegate.navigatorKey.currentState;
    if (navigator != null) {
      // GoRouter sahifalari (`Page` asosidagi) qoladi — ularni `go`
      // almashtiradi; popup va pageless route'lar shu yerda yopiladi.
      navigator.popUntil((route) => route.settings is Page);
    }
    router.go(loginLocation);
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthCubit, AuthState>(
      listenWhen: (previous, current) =>
          previous.isAuthenticated && !current.isAuthenticated,
      listener: (context, state) => _leaveToLogin(),
      child: child,
    );
  }
}
