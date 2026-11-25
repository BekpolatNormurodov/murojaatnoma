import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/features/auth/domain/entities/auth_session.dart';
import 'package:user_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:user_app/features/news/data/datasources/news_remote_data_source.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';
import 'package:user_app/injection.dart';

AuthSession sessionFor(String phone) => AuthSession(
  token: 't-$phone',
  userId: phone,
  name: phone,
  phone: phone,
  region: '',
);

/// Telefon raqamiga qarab sessiya beradigan soxta auth.
class FakeAuthRepository implements AuthRepository {
  AuthSession? current;
  int logouts = 0;

  /// Berilsa — server javobi shu tugaguncha "osilib turadi".
  Future<void>? logoutGate;

  /// Berilsa — chiqish shu xato bilan tugaydi (sessiya qoladi).
  Exception? logoutError;

  @override
  Future<Either<Failure, Unit>> sendOtp(String phone) async =>
      const Right(unit);

  @override
  Future<Either<Failure, AuthSession>> verifyOtp({
    required String phone,
    required String code,
  }) async => Right(current = sessionFor(phone));

  @override
  Future<AuthSession?> currentSession() async => current;

  @override
  Future<void> logout() async {
    logouts++;
    await logoutGate;
    final error = logoutError;
    if (error != null) throw error;
    current = null;
  }
}

class _NoNews implements NewsRemoteDataSource {
  @override
  Future<List<NewsItem>> list() async => const [];
}

/// To'liq DI (haqiqiy cubit/router/storage), tarmoq manbalari soxta.
Future<FakeAuthRepository> configureTestApp(Directory docs) async {
  SharedPreferences.setMockInitialValues({});
  FlutterSecureStorage.setMockInitialValues({});
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/path_provider'),
        (_) async => docs.path,
      );
  AppConfig.init(flavor: AppFlavor.test, useMock: true);
  await configureDependencies();
  final auth = FakeAuthRepository();
  getIt
    ..unregister<AuthRepository>()
    ..registerSingleton<AuthRepository>(auth)
    ..unregister<CitizenRequestsRemoteDataSource>()
    ..registerLazySingleton<CitizenRequestsRemoteDataSource>(
      CitizenRequestsRemoteDataSourceMockImpl.new,
    )
    ..unregister<NotificationsDataSource>()
    ..registerLazySingleton<NotificationsDataSource>(
      NotificationsMockDataSource.new,
    )
    ..unregister<NewsRemoteDataSource>()
    ..registerLazySingleton<NewsRemoteDataSource>(_NoNews.new);
  return auth;
}
