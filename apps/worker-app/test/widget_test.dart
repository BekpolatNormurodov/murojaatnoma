// Basic smoke test for the Hokimiyat worker app.
import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:worker_app/features/auth/domain/usecases/login_employee.dart';
import 'package:worker_app/features/auth/domain/usecases/restore_session.dart';
import 'package:worker_app/features/auth/domain/usecases/send_otp.dart';
import 'package:worker_app/features/auth/domain/usecases/verify_otp.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/auth/presentation/pages/phone_input_page.dart';

class _FakeRepo implements AuthRepository {
  @override
  Future<Either<Failure, String?>> sendOtp(String phone) async =>
      const Left(AuthFailure());

  @override
  Future<Either<Failure, AuthSession>> verifyOtp({
    required String phone,
    required String code,
  }) async => const Left(AuthFailure());

  @override
  Future<Either<Failure, AuthSession>> login({
    required String username,
    required String password,
  }) async => const Left(AuthFailure());

  @override
  Future<AuthSession?> currentSession() async => null;

  @override
  Future<void> logout() async {}
}

void main() {
  testWidgets('Phone input page renders', (tester) async {
    final repo = _FakeRepo();
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider(
          create: (_) => AuthCubit(
            sendOtp: SendOtp(repo),
            verifyOtp: VerifyOtp(repo),
            loginEmployee: LoginEmployee(repo),
            restoreSession: RestoreSession(repo),
          ),
          child: const PhoneInputPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(PhoneInputPage), findsOneWidget);
  });
}
