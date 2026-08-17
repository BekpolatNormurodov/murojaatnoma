import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';

part 'home_state.dart';

/// Fuqaro bosh sahifasi (dashboard)ini boshqaruvchi Cubit.
///
/// Umumiy "jami qarz" kartasi va tezkor xizmatlar uchun
/// `PaymentsRepository.utilities()`dan kelgan ro'yxatga tayanadi — to'liq
/// kommunal xizmatlar ro'yxati esa `UtilitiesCubit` orqali alohida
/// yuklanadi (bir xil ma'lumot, ikki mustaqil ekran/holat).
class HomeCubit extends Cubit<HomeState> {
  HomeCubit({required GetUtilities getUtilities})
    : _getUtilities = getUtilities,
      super(const HomeLoading());

  final GetUtilities _getUtilities;

  /// Kommunal xizmatlar ro'yxatini yuklaydi (yoki qayta yuklaydi — masalan
  /// pull-to-refresh yoki muvaffaqiyatli to'lovdan keyin).
  Future<void> load() async {
    emit(const HomeLoading());
    final result = await _getUtilities(const NoParams());
    result.fold(
      (failure) => emit(HomeError(failure.message)),
      (utilities) =>
          emit(utilities.isEmpty ? const HomeEmpty() : HomeLoaded(utilities)),
    );
  }
}
