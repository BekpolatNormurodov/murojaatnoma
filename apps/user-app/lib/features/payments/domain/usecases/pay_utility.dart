import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/repositories/payments_repository.dart';

/// Bitta kommunal xizmat turi bo'yicha to'lovni amalga oshirish.
class PayUtility implements UseCase<Payment, PayUtilityParams> {
  PayUtility(this.repository);

  final PaymentsRepository repository;

  @override
  Future<Either<Failure, Payment>> call(PayUtilityParams params) {
    return repository.pay(
      type: params.type,
      amount: params.amount,
      cardNumber: params.cardNumber,
    );
  }
}

/// [PayUtility] uchun kirish parametrlari.
class PayUtilityParams extends Equatable {
  const PayUtilityParams({
    required this.type,
    required this.amount,
    required this.cardNumber,
  });

  final UtilityType type;
  final double amount;

  /// Mock karta raqami (faqat ko'rsatish/tekshirish uchun — hech qachon
  /// saqlanmaydi).
  final String cardNumber;

  @override
  List<Object?> get props => [type, amount, cardNumber];
}
