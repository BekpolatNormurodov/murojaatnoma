part of 'salary_cubit.dart';

/// "Oyliklarim" sahifasining barcha holatlari.
///
/// `sealed` — `SalaryPage`dagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni ko'rsatishni unutib
/// qoldirish kompilyatsiya xatosiga aylanadi — "hech qachon oq/bo'sh ekran"
/// mandatining bir qismi (`PointsState` bilan bir xil naqsh).
sealed class SalaryState extends Equatable {
  const SalaryState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda — skeleton ko'rsatadi.
class SalaryLoading extends SalaryState {
  const SalaryLoading();
}

/// Maosh tarixi muvaffaqiyatli yuklandi va bo'sh emas.
class SalaryLoaded extends SalaryState {
  const SalaryLoaded(this.salaries);

  final List<Salary> salaries;

  @override
  List<Object?> get props => [salaries];
}

/// Xodimning hali oylik maosh yozuvi mavjud emas.
class SalaryEmpty extends SalaryState {
  const SalaryEmpty();
}

/// Yuklashda xatolik (server yoki kutilmagan) — [message] "Qayta urinish"
/// tugmasi bilan birga ko'rsatiladi.
class SalaryError extends SalaryState {
  const SalaryError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
