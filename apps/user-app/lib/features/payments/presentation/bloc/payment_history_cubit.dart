import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/core/monitoring/app_logger.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_payment_history.dart';
import 'package:user_app/injection.dart';

part 'payment_history_state.dart';

/// To'lovlar tarixi sahifasini boshqaruvchi Cubit.
///
/// **Cache-then-network**: [load] avval `CacheService`dagi oxirgi
/// ro'yxatni (bo'lsa) DARHOL ko'rsatadi (skeleton'siz), so'ng fonda
/// tarmoqdan yangisini so'raydi. Kesh mavjud bo'lib tarmoq
/// muvaffaqiyatsiz bo'lsa — eski (kesh) ro'yxat ekranda QOLDIRILADI, xato
/// faqat log qilinadi.
class PaymentHistoryCubit extends Cubit<PaymentHistoryState> {
  PaymentHistoryCubit({
    required GetPaymentHistory getPaymentHistory,
    CacheService? cache,
  }) : _getPaymentHistory = getPaymentHistory,
       _cache =
           cache ??
           (getIt.isRegistered<CacheService>()
               ? getIt<CacheService>()
               : null),
       super(const PaymentHistoryLoading());

  final GetPaymentHistory _getPaymentHistory;
  final CacheService? _cache;
  static const _logger = AppLogger();

  /// To'lovlar tarixini yuklaydi (yoki qayta yuklaydi).
  Future<void> load() async {
    final cached = _cache?.getJsonList<Payment>(
      Payment.cacheKey,
      Payment.fromJson,
    );
    if (cached != null && cached.isNotEmpty) {
      emit(PaymentHistoryLoaded(all: cached));
    } else {
      emit(const PaymentHistoryLoading());
    }

    final result = await _getPaymentHistory(const NoParams());
    result.fold(
      (failure) {
        if (cached != null && cached.isNotEmpty) {
          _logger.logError(failure, null, reason: 'PaymentHistoryCubit.load');
        } else {
          emit(PaymentHistoryError(failure.message));
        }
      },
      (payments) {
        unawaited(
          _cache?.setJson(
            Payment.cacheKey,
            payments.map((p) => p.toJson()).toList(),
          ),
        );
        emit(
          payments.isEmpty
              ? const PaymentHistoryEmpty()
              : PaymentHistoryLoaded(all: payments),
        );
      },
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
