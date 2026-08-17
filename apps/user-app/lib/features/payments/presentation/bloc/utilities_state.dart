part of 'utilities_cubit.dart';

/// Kommunal xizmatlar ro'yxati sahifasining barcha holatlari.
sealed class UtilitiesState extends Equatable {
  const UtilitiesState();

  @override
  List<Object?> get props => [];
}

/// Yuklanmoqda — skeleton ro'yxat ko'rsatiladi.
class UtilitiesLoading extends UtilitiesState {
  const UtilitiesLoading();
}

/// Ro'yxat muvaffaqiyatli yuklandi (kamida bitta yozuv bilan).
class UtilitiesLoaded extends UtilitiesState {
  const UtilitiesLoaded(this.utilities);

  final List<Utility> utilities;

  @override
  List<Object?> get props => [utilities];
}

/// Fuqaroga hali birorta kommunal xizmat hisobi biriktirilmagan.
class UtilitiesEmpty extends UtilitiesState {
  const UtilitiesEmpty();
}

/// Yuklashda xatolik yuz berdi — [message] "Qayta urinish" bilan
/// ko'rsatiladi.
class UtilitiesError extends UtilitiesState {
  const UtilitiesError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
