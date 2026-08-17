import 'dart:async';

import 'package:flutter/foundation.dart';

/// `Stream`ni (masalan, `AuthCubit.stream`) go_router'ning
/// `refreshListenable`iga bog'lovchi ko'prik.
///
/// GoRouter `redirect`ni faqat navigatsiya harakati (`go`/`push`/link)
/// bo'lganda qayta baholaydi — agar `AuthCubit` holati BUTUNLAY BOSHQA
/// sabab bilan o'zgarsa (masalan OTP tasdiqlangach `authenticated`ga
/// o'tsa yoki bootstrap paytida saqlangan sessiya tiklansa), GoRouter buni
/// o'zi bilmaydi — joriy manzilda "qotib qoladi". Shu klass aynan shu
/// holatni GoRouter'ga signal beradi:
/// `refreshListenable: GoRouterRefreshStream(getIt<AuthCubit>().stream)` —
/// har bir yangi holat GoRouter'ni joriy manzil uchun `redirect`ni QAYTA
/// ishga tushirishga majbur qiladi.
///
/// `worker_app`dagi bir xil nomli fayl bilan bir xil — standart go_router
/// retsepti (rasmiy hujjatlardagi bilan bir xil).
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    // Qurilgan zahoti bir marta bildirish — GoRouter dastlabki
    // `refreshListenable`ni ham hisobga olishi uchun (aksariyat holda
    // shart emas, lekin zararsiz va rasmiy retseptga mos).
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen(
      (_) => notifyListeners(),
    );
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
