import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/usecases/get_payment_history.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_requests.dart';

part 'reports_state.dart';

/// "Hisobot" sahifasini boshqaruvchi Cubit.
///
/// Alohida domen/mock qurmaydi — mavjud `PaymentsRepository` (to'lovlar
/// tarixi) va `CitizenRequestsRepository` (arizalar/shikoyatlar) orqali
/// olingan ma'lumotlardan [ReportsSummary]ni HISOBLAYDI (client-side
/// aggregatsiya).
class ReportsCubit extends Cubit<ReportsState> {
  ReportsCubit({
    required GetPaymentHistory getPaymentHistory,
    required GetCitizenRequests getCitizenRequests,
  }) : _getPaymentHistory = getPaymentHistory,
       _getCitizenRequests = getCitizenRequests,
       super(const ReportsLoading());

  final GetPaymentHistory _getPaymentHistory;
  final GetCitizenRequests _getCitizenRequests;

  /// Ikkala manbani (to'lovlar + murojaatlar) yuklaydi va jamlanma
  /// hisobotni chiqaradi. Ikkalasi ham PARALLEL boshlanadi (bir-birini
  /// kutmaydi) — mustaqil so'rovlar bo'lgani uchun.
  Future<void> load() async {
    emit(const ReportsLoading());
    try {
      final paymentsFuture = _getPaymentHistory(const NoParams());
      final requestsFuture = _getCitizenRequests(
        const GetCitizenRequestsParams(),
      );
      final paymentsResult = await paymentsFuture;
      final requestsResult = await requestsFuture;

      paymentsResult.fold(
        (failure) => emit(ReportsError(failure.message)),
        (payments) => requestsResult.fold(
          (failure) => emit(ReportsError(failure.message)),
          (requests) => emit(
            ReportsLoaded(
              ReportsSummary.compute(payments: payments, requests: requests),
            ),
          ),
        ),
      );
    } on Object catch (e) {
      emit(ReportsError('Kutilmagan xatolik: $e'));
    }
  }
}
