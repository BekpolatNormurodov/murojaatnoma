import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/repositories/payments_repository.dart';

/// Fuqaroning to'lovlar tarixini olish.
class GetPaymentHistory implements UseCase<List<Payment>, NoParams> {
  GetPaymentHistory(this.repository);

  final PaymentsRepository repository;

  @override
  Future<Either<Failure, List<Payment>>> call(NoParams params) {
    return repository.history();
  }
}
