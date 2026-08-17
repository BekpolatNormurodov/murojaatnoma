import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:worker_app/features/auth/data/models/auth_session_model.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({required this.remote, required this.prefs});

  final AuthRemoteDataSource remote;
  final SharedPreferences prefs;

  /// Sessiya JSON'i shu kalit ostida saqlanadi (workerId/ism/lavozim/hudud).
  static const _sessionKey = 'worker_session';

  @override
  Future<Either<Failure, Unit>> sendOtp(String phone) async {
    try {
      await remote.sendOtp(phone);
      return const Right(unit);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, AuthSession>> verifyOtp({
    required String phone,
    required String code,
  }) async {
    try {
      final session = await remote.verifyOtp(phone: phone, code: code);
      // `AuthInterceptor` har bir so'rovga shu kalitdan JWT o'qib qo'shadi.
      await prefs.setString(AuthInterceptor.tokenKey, session.token);
      await prefs.setString(_sessionKey, jsonEncode(session.toJson()));
      return Right(session);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<AuthSession?> currentSession() async {
    final raw = prefs.getString(_sessionKey);
    if (raw == null) return null;
    return AuthSessionModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  @override
  Future<void> logout() async {
    await prefs.remove(AuthInterceptor.tokenKey);
    await prefs.remove(_sessionKey);
  }
}
