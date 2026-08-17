import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/points/domain/entities/points.dart';
import 'package:worker_app/features/points/domain/usecases/get_current_points.dart';

part 'points_state.dart';

/// "Ballarim" (ball nazorati) sahifasini boshqaruvchi Cubit.
///
/// `GetCurrentPoints` natijasi (`WorkerPoints`) umumiy ball, reyting o'rni
/// VA to'liq tarixni BITTA so'rovda qaytaradi — shu tufayli sahifaning
/// hero kartasi va tarix ro'yxati bitta [load] chaqiruvi bilan
/// to'ldiriladi (ikkita mustaqil yuklanish holatini muvofiqlashtirish
/// shart emas).
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [PointsError] holatiga aylanadi.
class PointsCubit extends Cubit<PointsState> {
  PointsCubit({required GetCurrentPoints getCurrentPoints})
    : _getCurrentPoints = getCurrentPoints,
      super(const PointsLoading());

  final GetCurrentPoints _getCurrentPoints;

  Future<void> load() async {
    emit(const PointsLoading());
    try {
      final result = await _getCurrentPoints(const NoParams());
      result.fold((failure) => emit(PointsError(failure.message)), (points) {
        emit(
          points.history.isEmpty ? const PointsEmpty() : PointsLoaded(points),
        );
      });
    } on Object catch (e) {
      emit(PointsError('Kutilmagan xatolik: $e'));
    }
  }

  /// Qayta yuklaydi (pull-to-refresh yoki "Qayta urinish" tugmasi).
  Future<void> reload() => load();
}
