import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/face/data/datasources/face_local_data_source.dart';
import 'package:user_app/features/face/domain/entities/face_template.dart';
import 'package:user_app/features/face/domain/repositories/face_repository.dart';

/// `FaceRepository`ning xavfsiz-lokal-saqlash implementatsiyasi.
class FaceRepositoryImpl implements FaceRepository {
  FaceRepositoryImpl({required this.local});

  final FaceLocalDataSource local;

  @override
  Future<Either<Failure, Unit>> enroll(FaceTemplate t) async {
    try {
      await local.write(t);
      return const Right(unit);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
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
}
