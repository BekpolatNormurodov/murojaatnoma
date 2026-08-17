import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/foundation.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:worker_app/features/face/data/datasources/face_remote_data_source.dart';
import 'package:worker_app/features/face/domain/entities/face_match_result.dart';
import 'package:worker_app/features/face/domain/entities/face_template.dart';
import 'package:worker_app/features/face/domain/repositories/face_repository.dart';
import 'package:worker_app/features/face/domain/services/face_matcher.dart';

/// `FaceRepository`ning xavfsiz-lokal-saqlash implementatsiyasi.
///
/// Asosan `FaceLocalDataSource` (shifrlangan xotira) va `FaceMatcher`
/// (cosine solishtirish) bilan ishlaydi — solishtirish (`verify`) HAR
/// DOIM mahalliy (offline check-in shu tufayli ishlaydi): `verify`ga
/// keladigan probe allaqachon hisoblangan holda keladi (UI/controller
/// qatlami, Vazifa 16/17 tomonidan). `FaceEmbedder` bu qatlamga umuman
/// bog'liq emas.
///
/// `remote` (ixtiyoriy) — jonli backendga sinxronlash uchun (qarang:
/// [_syncToBackend]). `null` bo'lishi mumkin (masalan testlarda, yoki
/// `AppConfig.useMock == true` bo'lgan mock oqimda `injection.dart` uni
/// umuman ro'yxatdan o'tkazmasligi mumkin) — bunday holda sinxronlash
/// jimgina o'tkazib yuboriladi.
class FaceRepositoryImpl implements FaceRepository {
  FaceRepositoryImpl({required this.local, this.remote});

  final FaceLocalDataSource local;
  final FaceRemoteDataSource? remote;

  @override
  Future<Either<Failure, Unit>> enroll(FaceTemplate t) async {
    try {
      await local.write(t);
      await _syncToBackend(t);
      return const Right(unit);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }

  /// Mahalliy shablon saqlangandan KEYIN, jonli backendda (`useMock ==
  /// false`) HAM hisoblangan embeddingni yuklashga urinadi (`POST
  /// /employees/:id/face-template`, qarang: `FaceRemoteDataSourceApiImpl`).
  ///
  /// **BEST-EFFORT, hech qachon enrollmentni bekor qilmaydi**: yuklash
  /// muvaffaqiyatsiz bo'lsa (tarmoq yo'q, server band) — mahalliy shablon
  /// allaqachon saqlangan bo'lgani uchun offline check-in (mahalliy
  /// `FaceMatcher`) baribir ishlayveradi; xatolik faqat debug logga
  /// yumshoq ogohlantirish sifatida yoziladi ("soft warning"), `enroll()`
  /// natijasi (`Right(unit)`) o'zgarmaydi.
  Future<void> _syncToBackend(FaceTemplate t) async {
    final remoteDs = remote;
    if (AppConfig.useMock || remoteDs == null) return;
    try {
      await remoteDs.uploadEmbedding(t.workerId, t.embedding);
    } on Object catch (e) {
      if (kDebugMode) {
        debugPrint(
          'FaceRepositoryImpl: backendga yuz shablonini yuklab '
          "bo'lmadi (mahalliy ro'yxatdan o'tish saqlanib qoldi): $e",
        );
      }
    }
  }

  @override
  Future<Either<Failure, FaceTemplate?>> getTemplate() async {
    try {
      final template = await local.read();
      return Right(template);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, FaceMatchResult>> verify(
    List<double> probe, {
    double threshold = kFaceMatchThreshold,
  }) async {
    try {
      final template = await local.read();
      if (template == null) {
        return const Left(
          CacheFailure("Yuz shabloni topilmadi: avval ro'yxatdan o'ting"),
        );
      }
      return Right(
        FaceMatcher().match(probe, template.embedding, threshold: threshold),
      );
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }
}
