import 'package:app_core/app_core.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/salary/domain/entities/salary.dart';
import 'package:worker_app/features/salary/domain/usecases/get_my_salaries.dart';

part 'salary_state.dart';

/// "Oyliklarim" sahifasini boshqaruvchi Cubit (`PointsCubit` bilan bir xil
/// naqsh).
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [SalaryError] holatiga aylanadi; bo'sh ro'yxat esa [SalaryEmpty]ga.
class SalaryCubit extends Cubit<SalaryState> {
  SalaryCubit({required GetMySalaries getMySalaries})
    : _getMySalaries = getMySalaries,
      super(const SalaryLoading());

  final GetMySalaries _getMySalaries;

  Future<void> load() async {
    emit(const SalaryLoading());
    try {
      final result = await _getMySalaries(const NoParams());
      result.fold((failure) => emit(SalaryError(failure.message)), (salaries) {
        emit(salaries.isEmpty ? const SalaryEmpty() : SalaryLoaded(salaries));
      });
    } on Object catch (e) {
      emit(SalaryError('Kutilmagan xatolik: $e'));
    }
  }

  /// Qayta yuklaydi (pull-to-refresh yoki "Qayta urinish" tugmasi).
  Future<void> reload() => load();
}
