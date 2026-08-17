import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';

/// Fuqaroning kommunal xizmatlari (kommunalka) va to'lovlari uchun
/// shartnoma.
abstract class PaymentsRepository {
  /// Fuqaroga biriktirilgan barcha kommunal xizmat hisoblarini oladi.
  Future<Either<Failure, List<Utility>>> utilities();

  /// Bitta kommunal xizmat turi bo'yicha to'lovni amalga oshiradi.
  Future<Either<Failure, Payment>> pay({
    required UtilityType type,
    required double amount,
    required String cardNumber,
  });

  /// To'lovlar tarixini oladi.
  Future<Either<Failure, List<Payment>>> history();
}
