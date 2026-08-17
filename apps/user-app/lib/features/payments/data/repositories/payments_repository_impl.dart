import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/payments/data/datasources/payments_remote_data_source.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/repositories/payments_repository.dart';

/// `PaymentsRepository`ning masofaviy-manba (mock/api) implementatsiyasi.
class PaymentsRepositoryImpl implements PaymentsRepository {
  PaymentsRepositoryImpl({required this.remote});

  final PaymentsRemoteDataSource remote;

  @override
  Future<Either<Failure, List<Utility>>> utilities() async {
    try {
      return Right(await remote.utilities());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, Payment>> pay({
    required UtilityType type,
    required double amount,
    required String cardNumber,
  }) async {
    try {
      final payment = await remote.pay(
        type: type,
        amount: amount,
        cardNumber: cardNumber,
      );
      return Right(payment);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }

  @override
  Future<Either<Failure, List<Payment>>> history() async {
    try {
      return Right(await remote.history());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } on Exception catch (_) {
      return const Left(ServerFailure('Serverda xatolik yuz berdi'));
    }
  }
}
