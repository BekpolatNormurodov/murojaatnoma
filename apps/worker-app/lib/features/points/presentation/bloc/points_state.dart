part of 'points_cubit.dart';

/// "Ballarim" sahifasining barcha holatlari.
///
/// `sealed` — `PointsPage`dagi `switch` ifodasi compiler tomonidan
/// to'liq (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni
/// ko'rsatishni unutib qoldirish kompilyatsiya xatosiga aylanadi —
/// "hech qachon oq/bo'sh ekran" mandatining bir qismi.
sealed class PointsState extends Equatable {
  const PointsState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda — hero karta + tarix skeleton ko'rsatadi.
class PointsLoading extends PointsState {
  const PointsLoading();
}

/// Ball ma'lumotlari muvaffaqiyatli yuklandi va tarix bo'sh emas.
class PointsLoaded extends PointsState {
  const PointsLoaded(this.points);

  final WorkerPoints points;

  @override
  List<Object?> get props => [points];
}

/// Xodimning hali ball tarixi mavjud emas (yangi xodim).
class PointsEmpty extends PointsState {
  const PointsEmpty();
}

/// Yuklashda xatolik (server yoki kutilmagan) — [message] "Qayta urinish"
/// tugmasi bilan birga ko'rsatiladi.
class PointsError extends PointsState {
  const PointsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
