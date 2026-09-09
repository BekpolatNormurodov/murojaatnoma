import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:worker_app/features/salary/domain/entities/salary.dart';

/// "Oyliklarim" moduli bilan ishlash uchun shartnoma — xodimning O'Z
/// oylik maosh tarixini (eng yangi oy birinchi) o'qish.
// ignore: one_member_abstracts
abstract class SalaryRepository {
  /// Xodimning o'z oylik maosh tarixini oladi (`GET /salaries/me`).
  Future<Either<Failure, List<Salary>>> mine();
}
