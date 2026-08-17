import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/registration/data/datasources/registration_local_data_source.dart';
import 'package:user_app/features/registration/domain/entities/citizen_profile.dart';
import 'package:user_app/features/registration/domain/repositories/registration_repository.dart';

/// `RegistrationRepository`ning xavfsiz-lokal-saqlash implementatsiyasi —
/// `FaceRepositoryImpl` bilan bir xil naqsh.
class RegistrationRepositoryImpl implements RegistrationRepository {
  RegistrationRepositoryImpl({required this.local});

  final RegistrationLocalDataSource local;

  @override
  Future<Either<Failure, Unit>> saveProfile(CitizenProfile profile) async {
    try {
      await local.write(profile);
      return const Right(unit);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, CitizenProfile?>> getProfile() async {
    try {
      final profile = await local.read();
      return Right(profile);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }
}
