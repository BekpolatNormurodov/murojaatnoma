part of 'home_cubit.dart';

/// Fuqaro bosh sahifasi (dashboard)ining barcha holatlari.
///
/// `sealed` — `HomePage`dagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi.
sealed class HomeState extends Equatable {
  const HomeState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (yoki qayta yuklanganda) — sahifa skeleton
/// ko'rsatadi, hech qachon oq/bo'sh ekran emas.
class HomeLoading extends HomeState {
  const HomeLoading();
}

/// Kommunal xizmatlar muvaffaqiyatli yuklandi (kamida bitta yozuv bilan).
class HomeLoaded extends HomeState {
  const HomeLoaded(this.utilities);

  final List<Utility> utilities;

  /// Barcha xizmatlar bo'yicha umumiy qarzdorlik summasi.
  double get totalDue =>
      utilities.fold<double>(0, (sum, u) => sum + u.balanceDue);

  @override
  List<Object?> get props => [utilities];
}

/// `PaymentsRepository.utilities()` bo'sh ro'yxat qaytardi — fuqaroga
/// hali birorta kommunal xizmat hisobi biriktirilmagan.
class HomeEmpty extends HomeState {
  const HomeEmpty();
}

/// `utilities()` `Left(Failure)` qaytardi (yoki kutilmagan istisno) —
/// [message] "Qayta urinish" tugmasi bilan ko'rsatiladi.
class HomeError extends HomeState {
  const HomeError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
