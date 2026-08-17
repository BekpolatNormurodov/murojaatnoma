import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/payments/domain/usecases/get_utilities.dart';

part 'utilities_state.dart';

/// "Kommunalka" (To'lovlar tabi) sahifasini boshqaruvchi Cubit.
class UtilitiesCubit extends Cubit<UtilitiesState> {
  UtilitiesCubit({required GetUtilities getUtilities})
    : _getUtilities = getUtilities,
      super(const UtilitiesLoading());

  final GetUtilities _getUtilities;

  /// Kommunal xizmatlar ro'yxatini yuklaydi (yoki qayta yuklaydi — masalan
  /// pull-to-refresh yoki muvaffaqiyatli to'lovdan keyin).
  Future<void> load() async {
    emit(const UtilitiesLoading());
    final result = await _getUtilities(const NoParams());
    result.fold(
      (failure) => emit(UtilitiesError(failure.message)),
      (utilities) => emit(
        utilities.isEmpty ? const UtilitiesEmpty() : UtilitiesLoaded(utilities),
      ),
    );
  }
}
