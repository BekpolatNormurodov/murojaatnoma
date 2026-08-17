part of 'reports_cubit.dart';

/// "Hisobot" sahifasining barcha holatlari.
sealed class ReportsState extends Equatable {
  const ReportsState();

  @override
  List<Object?> get props => [];
}

/// Yuklanmoqda — skeleton ko'rsatiladi.
class ReportsLoading extends ReportsState {
  const ReportsLoading();
}

/// Hisobot muvaffaqiyatli hisoblandi.
class ReportsLoaded extends ReportsState {
  const ReportsLoaded(this.summary);

  final ReportsSummary summary;

  @override
  List<Object?> get props => [summary];
}

/// Yuklashda xatolik yuz berdi — [message] "Qayta urinish" bilan
/// ko'rsatiladi.
class ReportsError extends ReportsState {
  const ReportsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// Fuqaroning faoliyati bo'yicha jamlanma hisobot — to'lovlar tarixi va
/// murojaatlar (ariza/shikoyat) ro'yxatidan CLIENT-SIDE hisoblanadi.
class ReportsSummary extends Equatable {
  const ReportsSummary({
    required this.paymentsCount,
    required this.paymentsTotalAmount,
    required this.requestsCountByKind,
    required this.requestsCountByStatus,
  });

  factory ReportsSummary.compute({
    required List<Payment> payments,
    required List<CitizenRequest> requests,
  }) {
    final byKind = <RequestKind, int>{for (final k in RequestKind.values) k: 0};
    final byStatus = <RequestStatus, int>{
      for (final s in RequestStatus.values) s: 0,
    };
    for (final request in requests) {
      byKind[request.kind] = (byKind[request.kind] ?? 0) + 1;
      byStatus[request.status] = (byStatus[request.status] ?? 0) + 1;
    }
    final paymentsTotal = payments
        .where((p) => p.status == PaymentStatus.success)
        .fold<double>(0, (sum, p) => sum + p.amount);

    return ReportsSummary(
      paymentsCount: payments.length,
      paymentsTotalAmount: paymentsTotal,
      requestsCountByKind: byKind,
      requestsCountByStatus: byStatus,
    );
  }

  final int paymentsCount;
  final double paymentsTotalAmount;
  final Map<RequestKind, int> requestsCountByKind;
  final Map<RequestStatus, int> requestsCountByStatus;

  int get totalRequests =>
      requestsCountByKind.values.fold(0, (a, b) => a + b);

  @override
  List<Object?> get props => [
    paymentsCount,
    paymentsTotalAmount,
    requestsCountByKind,
    requestsCountByStatus,
  ];
}
