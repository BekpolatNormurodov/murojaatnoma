import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/profile/presentation/pages/personal_info_page.dart';
import 'package:worker_app/injection.dart';

class _Repo extends Mock implements AttendanceRepository {}

class _Auth extends Mock implements AuthCubit {}

void main() {
  testWidgets('personal info does not look "loading" forever after an error', (
    tester,
  ) async {
    await getIt.reset();
    addTearDown(getIt.reset);
    final repo = _Repo();
    when(
      repo.myAttendance,
    ).thenAnswer((_) async => const Left(ServerFailure('offline')));
    getIt.registerSingleton<AttendanceRepository>(repo);
    final auth = _Auth();
    when(() => auth.state).thenReturn(const AuthState());
    when(() => auth.stream).thenAnswer((_) => const Stream.empty());
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider<AuthCubit>.value(
          value: auth,
          child: const PersonalInfoPage(),
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('…'), findsNothing);
    expect(find.text('Ish vaqti'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 5));
  });
}
