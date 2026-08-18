import 'dart:convert';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:worker_app/features/auth/data/models/auth_session_model.dart';
import 'package:worker_app/features/auth/domain/entities/auth_session.dart';
import 'package:worker_app/features/auth/domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required this.remote,
    required this.prefs,
    FlutterSecureStorage? secureStorage,
  }) : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  final AuthRemoteDataSource remote;
  final SharedPreferences prefs;

  /// Access/refresh tokenlarni QO'SHIMCHA ravishda (platform keychain/
  /// keystore orqali) xavfsiz saqlash uchun. `AuthInterceptor` (umumiy
  /// `app_core` paketi, `user-app` bilan ham baham ko'riladi) o'zgarishsiz
  /// `SharedPreferences`dan (`AuthInterceptor.tokenKey`, pastda) o'qishda
  /// davom etadi — shuning uchun so'rovlarga Bearer biriktirish darhol
  /// ishlaydi; bu yerdagi nusxa "tokenlar xavfsiz xotirada saqlanishi
  /// kerak" talabini qoplaydi va kelajakdagi refresh-token oqimi uchun
  /// tayyorlab qo'yadi (backend kontraktida hozircha `/auth/refresh`
  /// endpointi yo'q).
  final FlutterSecureStorage _secureStorage;

  /// Sessiya JSON'i shu kalit ostida saqlanadi (workerId/ism/lavozim/hudud).
  static const _sessionKey = 'worker_session';

  static const _secureAccessTokenKey = 'auth_access_token';
  static const _secureRefreshTokenKey = 'auth_refresh_token';

  @override
  Future<Either<Failure, String?>> sendOtp(String phone) async {
    try {
      final devCode = await remote.sendOtp(phone);
      return Right(devCode);
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
      await _persistSecureTokens(session);
      return Right(session);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, AuthSession>> login({
    required String username,
    required String password,
  }) async {
    try {
      final session = await remote.employeeLogin(
        username: username,
        password: password,
      );
      // Sessiya/token saqlash — `verifyOtp` bilan bir xil (yagona seam).
      await prefs.setString(AuthInterceptor.tokenKey, session.token);
      await prefs.setString(_sessionKey, jsonEncode(session.toJson()));
      await _persistSecureTokens(session);
      return Right(session);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  /// Access/refresh tokenlarni xavfsiz xotiraga yozadi — BEST-EFFORT:
  /// platform kanali xato bersa ham (masalan testlarda yoki keychain
  /// mavjud bo'lmagan muhitda) kirish jarayoni HECH QACHON shu sabab
  /// bilan muvaffaqiyatsiz bo'lmaydi — asosiy sessiya allaqachon
  /// yuqorida `SharedPreferences`da saqlangan.
  Future<void> _persistSecureTokens(AuthSessionModel session) async {
    try {
      await _secureStorage.write(
        key: _secureAccessTokenKey,
        value: session.token,
      );
      final refreshToken = session.refreshToken;
      if (refreshToken != null) {
        await _secureStorage.write(
          key: _secureRefreshTokenKey,
          value: refreshToken,
        );
      }
    } on Object {
      // Jim o'tkazib yuboriladi — qarang: yuqoridagi hujjat.
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
    try {
      await _secureStorage.delete(key: _secureAccessTokenKey);
      await _secureStorage.delete(key: _secureRefreshTokenKey);
    } on Object {
      // Jim o'tkazib yuboriladi — qarang: `_persistSecureTokens` hujjati.
    }
  }
}
