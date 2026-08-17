import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/app/router/app_router.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
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
          );
        },
      ),
    );
  }
}
