import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:user_app/app/router/app_router.dart';
import 'package:user_app/core/session/account_data_store.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/injection.dart';

/// Fuqaro ilovasidan chiqishning YAGONA yo'li — "Chiqish" tugmasi
/// (`ProfilePage`), "PIN kodni unutdim" (`PinUnlockPage`) VA server sessiyani
/// rad etganda (`AuthInterceptor.sessionExpired`, `main.dart`) hammasi shuni
/// chaqiradi.
///
/// Tartib:
///  1. `AuthRepository.logout()` — server/tokenlar/sessiya/oflayn kesh;
///  2. bildirishnomalar, ro'yxat keshlari va yagona (singleton) cubit'lar
///     tozalanadi;
///  3. ochiq qolgan barcha popup/dialog/sheet yopiladi (aks holda barrier
///     "qora ekran" bo'lib osilib qolardi);
///  4. `AuthCubit.reset()` va `/login`ga o'tish.
///
/// Profil/yuz/PIN o'chirilmaydi: shu fuqaro qayta kirsa tiklanadi, boshqa
/// raqam kirsa [AccountDataStore.claim] ularni o'chiradi.
///
/// Hech qachon xato tashlamaydi; bir vaqtda faqat bittasi bajariladi
/// (parallel 401'lar bir nechta `sessionExpired` yuborishi mumkin).
class LogoutService {
  LogoutService({
    required AuthRepository authRepository,
    required AuthCubit authCubit,
    NotificationsCubit? notificationsCubit,
    AccountDataStore? accountData,
    List<void Function()> resetters = const [],
    GoRouter Function()? router,
  }) : _authRepository = authRepository,
       _authCubit = authCubit,
       _notificationsCubit = notificationsCubit,
       _accountData = accountData,
       _resetters = resetters,
       _router = router ?? (() => getIt<AppRouter>().config);

  final AuthRepository _authRepository;
  final AuthCubit _authCubit;
  final NotificationsCubit? _notificationsCubit;
  final AccountDataStore? _accountData;
  final List<void Function()> _resetters;
  final GoRouter Function() _router;

  Future<void>? _running;
  bool _forgetPin = false;

  /// [router] — chaqiruvchi o'z kontekstidagi routerni bera oladi
  /// (masalan `GoRouter.of(context)`); berilmasa ilova routeri ishlatiladi.
  /// [forgetPin] — PIN ham o'chiriladi (unutilgan yoki urinishlar tugagan).
  ///
  /// PIN sessiya o'chirilgandan KEYIN o'chiriladi: aks holda server javobi
  /// kutilayotganda (≤5 s) ilova yopilsa, "sessiya bor, PIN yo'q" qolib,
  /// SMS kodsiz yangi PIN qo'yib kirish mumkin bo'lardi.
  Future<void> logout({GoRouter? router, bool forgetPin = false}) {
    if (forgetPin) _forgetPin = true;
    return _running ??= _perform(router).whenComplete(() => _running = null);
  }

  Future<void> _guard(Future<void> Function() step) async {
    try {
      await step();
    } on Object {
      // Chiqish HECH QACHON to'xtab qolmasin (masalan saqlash xatosi).
    }
  }

  Future<void> _perform(GoRouter? router) async {
    await _guard(_authRepository.logout);
    await _guard(() async => _notificationsCubit?.clear());
    await _guard(() async => _accountData?.clearSessionData());
    for (final reset in _resetters) {
      await _guard(() async => reset());
    }
    if (_forgetPin) {
      _forgetPin = false;
      await _guard(() async {
        // Sessiya o'chmay qolgan bo'lsa PIN qulfi joyida qoladi.
        if (await _authRepository.currentSession() == null) {
          await _accountData?.clearPin();
        }
      });
    }

    GoRouter? target;
    try {
      target = router ?? _router();
    } on Object {
      target = null;
    }
    // GoRouter sahifalari PopupRoute EMAS — saqlanadi; faqat
    // dialog/sheet/menu'lar yopiladi.
    target?.routerDelegate.navigatorKey.currentState?.popUntil(
      (route) => route is! PopupRoute,
    );
    _authCubit.reset();
    target?.go('/login');
  }
}
