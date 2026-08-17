import 'package:app_core/app_core.dart';
import 'package:dio/dio.dart';
import 'package:user_app/core/mock/mock_payments.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';

/// Kommunal xizmatlar (kommunalka) uchun masofaviy ma'lumot manbai.
abstract class PaymentsRemoteDataSource {
  Future<List<Utility>> utilities();

  Future<Payment> pay({
    required UtilityType type,
    required double amount,
    required String cardNumber,
  });

  Future<List<Payment>> history();
}

/// Mock implementatsiya (backend tayyor bo'lguncha) — [AppConfig.useMock]
/// `true` bo'lganda ishlatiladi. `mock_payments.dart`dagi xotiradagi
/// ro'yxatlar bilan ishlaydi.
class PaymentsRemoteDataSourceMockImpl implements PaymentsRemoteDataSource {
  @override
  Future<List<Utility>> utilities() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    return List.unmodifiable(mockUtilities);
  }

  @override
  Future<Payment> pay({
    required UtilityType type,
    required double amount,
    required String cardNumber,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));

    // Mock validatsiya — haqiqiy karta hech qachon saqlanmaydi/uzatilmaydi,
    // faqat oxirgi 4 raqami ko'rsatish uchun ushlab qolinadi.
    final digits = cardNumber.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 16) {
      throw ServerException('Karta raqami noto‘g‘ri kiritildi');
    }
    if (amount <= 0) {
      throw ServerException('To‘lov summasi noto‘g‘ri');
    }

    final index = mockUtilities.indexWhere((u) => u.type == type);
    if (index != -1) {
      final current = mockUtilities[index];
      final updatedBalance = current.balanceDue - amount;
      mockUtilities[index] = Utility(
        id: current.id,
        type: current.type,
        provider: current.provider,
        accountNumber: current.accountNumber,
        balanceDue: updatedBalance < 0 ? 0 : updatedBalance,
        lastInvoiceAt: current.lastInvoiceAt,
      );
    }

    final payment = Payment(
      id: 'PAY-${DateTime.now().millisecondsSinceEpoch}',
      type: type,
      amount: amount,
      paidAt: DateTime.now().toIso8601String(),
      status: PaymentStatus.success,
      cardLast4: digits.substring(digits.length - 4),
    );
    mockPaymentHistory.insert(0, payment);
    return payment;
  }

  @override
  Future<List<Payment>> history() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    return List.unmodifiable(mockPaymentHistory);
  }
}

/// Real backend implementatsiyasi — [DioClient] orqali.
class PaymentsApiImpl implements PaymentsRemoteDataSource {
  PaymentsApiImpl(this._client);

  final DioClient _client;

  @override
  Future<List<Utility>> utilities() async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/payments/utilities',
      );
      final data = response.data ?? const [];
      return data
          .map((e) => Utility.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<Payment> pay({
    required UtilityType type,
    required double amount,
    required String cardNumber,
  }) async {
    try {
      final response = await _client.dio.post<Map<String, dynamic>>(
        '/payments/pay',
        data: {'type': type.name, 'amount': amount, 'card_number': cardNumber},
      );
      return Payment.fromJson(response.data ?? const {});
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }

  @override
  Future<List<Payment>> history() async {
    try {
      final response = await _client.dio.get<List<dynamic>>(
        '/payments/history',
      );
      final data = response.data ?? const [];
      return data
          .map((e) => Payment.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ServerException(e.message ?? 'Server xatosi');
    }
  }
}
