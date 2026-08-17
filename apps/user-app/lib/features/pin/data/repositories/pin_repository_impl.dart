import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/pin/data/datasources/pin_local_data_source.dart';
import 'package:user_app/features/pin/domain/repositories/pin_repository.dart';
import 'package:user_app/features/pin/domain/services/pin_hasher.dart';

/// `PinRepository`ning xavfsiz-lokal-saqlash implementatsiyasi —
/// `FaceRepositoryImpl` bilan bir xil naqsh (xato ushlash/`Failure`ga
/// aylantirish uslubi).
class PinRepositoryImpl implements PinRepository {
  PinRepositoryImpl({required this.local});

  final PinLocalDataSource local;

  @override
  Future<Either<Failure, Unit>> setPin(String pin) async {
    try {
      await local.writeHash(const PinHasher().hash(pin));
      return const Right(unit);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, bool>> verifyPin(String pin) async {
    try {
      final stored = await local.readHash();
      if (stored == null) return const Right(false);
      return Right(stored == const PinHasher().hash(pin));
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, bool>> hasPin() async {
    try {
      final stored = await local.readHash();
      return Right(stored != null);
    } on CacheException catch (e) {
      return Left(CacheFailure(e.message));
    } on Exception catch (_) {
      return const Left(CacheFailure('Kutilmagan keshda xatolik yuz berdi'));
    }
  }
}
