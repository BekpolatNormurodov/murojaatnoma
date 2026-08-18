import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/app/router/app_router.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/calls/presentation/bloc/call_cubit.dart';
import 'package:worker_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:worker_app/injection.dart';

/// Ishchi ilovasining ildiz widget'i — mavzu, til va routerni ulaydi.
class WorkerApp extends StatelessWidget {
  const WorkerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => getIt<ThemeCubit>()..load()),
        BlocProvider(create: (_) => getIt<LocaleCubit>()..load()),
        BlocProvider(create: (_) => getIt<AuthCubit>()),
        BlocProvider(create: (_) => getIt<NotificationsCubit>()..load()),
        // GLOBAL qo'ng'iroq boshqaruvchisi — kiruvchi `call:incoming`ni
        // (jonli socket orqali) tinglaydi. Instansiya `injection.dart`da
        // lazy singleton, shuning uchun `/call/:id` marshruti va FCM
        // bildirishnoma bosilishi ham XUDDI SHUNI ishlatadi.
        BlocProvider(create: (_) => getIt<CallCubit>()),
      ],
      child: Builder(
        builder: (context) {
          final mode = context.watch<ThemeCubit>().state;
          final locale = context.watch<LocaleCubit>().state;
          return MaterialApp.router(
            title: 'Hokimiyat Ishchi',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: mode,
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            routerConfig: getIt<AppRouter>().config,
            // Har bir ekranni o'rab, kiruvchi/chiquvchi qo'ng'iroq boshlanganda
            // `/call/:id` to'liq-ekran sahifasiga AVTOMATIK o'tadigan global
            // tinglovchi qo'shamiz (navigatsiyaning YAGONA manbai — UI o'zi
            // navigatsiya qilmaydi).
            builder: (context, child) => _CallNavigationHost(
              child: child ?? const SizedBox.shrink(),
            ),
          );
        },
      ),
    );
  }
}

/// [CallCubit] holatini kuzatib, qo'ng'iroq faollashganda `/call/:id`
/// sahifasini BIR MARTA ochadigan global "host". Sovuq ishga tushishda
/// (FCM bildirishnoma orqali qo'ng'iroq allaqachon o'rnatilgan bo'lsa)
/// birinchi kadrdan keyin ham tekshiradi.
class _CallNavigationHost extends StatefulWidget {
  const _CallNavigationHost({required this.child});

  final Widget child;

  @override
  State<_CallNavigationHost> createState() => _CallNavigationHostState();
}

class _CallNavigationHostState extends State<_CallNavigationHost> {
  bool _onCallScreen = false;

  static bool _isLiveCall(CallPhase phase) =>
      phase == CallPhase.incoming ||
      phase == CallPhase.outgoing ||
      phase == CallPhase.connecting ||
      phase == CallPhase.active;

  @override
  void initState() {
    super.initState();
    // Sovuq start (FCM push -> acceptFromPush allaqachon holatni o'rnatgan
    // bo'lishi mumkin) — BlocListener bunday boshlang'ich holat uchun
    // ishlamaydi, shuning uchun birinchi kadrdan keyin qo'lda tekshiramiz.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _maybeNavigate(context.read<CallCubit>().state);
    });
  }

  void _maybeNavigate(CallState state) {
    if (_isLiveCall(state.phase)) {
      if (!_onCallScreen) {
        _onCallScreen = true;
        getIt<AppRouter>().config.push('/call/${state.callId ?? 'active'}');
      }
    } else if (state.phase == CallPhase.idle) {
      _onCallScreen = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<CallCubit, CallState>(
      listener: (context, state) => _maybeNavigate(state),
      child: widget.child,
    );
  }
}
