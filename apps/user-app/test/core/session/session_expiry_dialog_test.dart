import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/core/session/logout_service.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';
import 'package:user_app/features/requests/presentation/pages/submit_request_page.dart';

import '../../support/fonts.dart';
import '../../support/small_screen.dart';

class _Repo extends Mock implements AuthRepository {}

class _Auth extends MockCubit<AuthState> implements AuthCubit {}

class _Submit extends MockCubit<SubmitRequestState>
    implements SubmitRequestCubit {}

const _created = CitizenRequest(
  id: 'a1',
  kind: RequestKind.ariza,
  category: 'c',
  title: 'title',
  body: 'body body body',
  status: RequestStatus.yuborilgan,
  createdAt: '2026-11-01T10:00:00',
);

void main() {
  setUpAll(loadTestFonts);

  testWidgets('session expiring under the "sent" dialog lands on /login '
      'without popping the login page', (tester) async {
    useSmallScreen(tester);
    final repo = _Repo();
    when(repo.logout).thenAnswer((_) async {});
    final submit = _Submit();
    when(submit.loadDefaultLocation).thenAnswer((_) async => null);
    final states = StreamController<SubmitRequestState>();
    addTearDown(states.close);
    whenListen(
      submit,
      states.stream,
      initialState: const SubmitRequestSubmitting(),
    );
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: Text('start-page')),
        ),
        GoRoute(
          path: '/login',
          builder: (_, _) => const Scaffold(body: Text('login-page')),
        ),
        GoRoute(
          path: '/submit',
          builder: (_, _) => BlocProvider<SubmitRequestCubit>.value(
            value: submit,
            child: const SubmitRequestPage(),
          ),
        ),
      ],
    );
    final l10n = lookupAppLocalizations(const Locale('uz'));
    await tester.pumpWidget(
      MaterialApp.router(
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    );
    router.push('/submit').ignore();
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    states.add(const SubmitRequestSuccess(_created));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    expect(find.text(l10n.createRequestSuccessTitle), findsOneWidget);

    final service = LogoutService(
      authRepository: repo,
      authCubit: _Auth(),
      router: () => router,
    );
    unawaited(service.logout());
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('login-page'), findsOneWidget);
    expect(find.text(l10n.createRequestSuccessTitle), findsNothing);
    await drainFonts(tester);
  });
}
