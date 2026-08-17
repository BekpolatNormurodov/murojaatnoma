import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_payment_history.dart';

part 'payment_history_state.dart';

/// To'lovlar tarixi sahifasini boshqaruvchi Cubit.
class PaymentHistoryCubit extends Cubit<PaymentHistoryState> {
  PaymentHistoryCubit({required GetPaymentHistory getPaymentHistory})
    : _getPaymentHistory = getPaymentHistory,
      super(const PaymentHistoryLoading());

  final GetPaymentHistory _getPaymentHistory;

  /// To'lovlar tarixini yuklaydi (yoki qayta yuklaydi).
  Future<void> load() async {
    emit(const PaymentHistoryLoading());
    final result = await _getPaymentHistory(const NoParams());
    result.fold(
      (failure) => emit(PaymentHistoryError(failure.message)),
      (payments) => emit(
        payments.isEmpty
            ? const PaymentHistoryEmpty()
            : PaymentHistoryLoaded(all: payments),
      ),
    );
  }

  /// Ro'yxatni kommunal xizmat turi bo'yicha mahalliy filtrlaydi
  /// (`null` — barchasi). Faqat [PaymentHistoryLoaded] holatida ma'noli.
  void filterByType(UtilityType? type) {
    final current = state;
    if (current is PaymentHistoryLoaded) {
      emit(PaymentHistoryLoaded(all: current.all, typeFilter: type));
    }
  }
}
