import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/requests/domain/entities/application.dart';
import 'package:worker_app/features/requests/domain/repositories/applications_repository.dart';

part 'requests_state.dart';

/// "Murojaatlar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// Joriy filtrlarni (`assignedOnly`/`status`/`priority`/`query`) ichida
/// saqlaydi — shu tufayli [reload] (pull-to-refresh, "Qayta urinish" yoki
/// tafsilot sahifasidan qaytgach) parametrsiz chaqirilib, so'nggi
/// ishlatilgan filtrlar bilan qayta so'rov yuboradi.
///
/// [ApplicationsRepository.list] `priority` bo'yicha filtrlashni
/// qo'llab-quvvatlamaydi (shartnomada yo'q) — shuning uchun muhimlik
/// filtri natija ustida MIJOZ TOMONIDA qo'llaniladi.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [RequestsError] holatiga aylanadi.
class RequestsCubit extends Cubit<RequestsState> {
  RequestsCubit({required ApplicationsRepository repository})
    : _repository = repository,
      super(const RequestsLoading());

  final ApplicationsRepository _repository;

  bool _assignedOnly = true;
  ApplicationStatus? _status;
  ApplicationPriority? _priority;
  String? _query;

  bool get assignedOnly => _assignedOnly;
  ApplicationStatus? get statusFilter => _status;
  ApplicationPriority? get priorityFilter => _priority;
  String? get query => _query;

  /// `true` bo'lsa holat yoki muhimlik filtrlaridan biri tanlangan —
  /// filtr tugmasining faol-holat ko'rsatkichi uchun.
  bool get hasActiveFilters => _status != null || _priority != null;

  /// Murojaatlar ro'yxatini (berilgan filtrlar bilan) yuklaydi. Har doim
  /// [RequestsLoading] bilan boshlanadi — tab/qidiruv/filtr almashganda
  /// ham eski ro'yxat ustida "muzlab qolgan" holat ko'rinmaydi.
  Future<void> load({
    bool assignedOnly = true,
    ApplicationStatus? status,
    ApplicationPriority? priority,
    String? query,
  }) async {
    _assignedOnly = assignedOnly;
    _status = status;
    _priority = priority;
    _query = query;

    emit(const RequestsLoading());
    try {
      final result = await _repository.list(
        assignedOnly: assignedOnly,
        status: status,
        query: query,
      );
      result.fold((failure) => emit(RequestsError(failure.message)), (items) {
        final filtered = priority == null
            ? items
            : items.where((a) => a.priority == priority).toList();
        emit(
          filtered.isEmpty ? const RequestsEmpty() : RequestsLoaded(filtered),
        );
      });
    } on Object catch (e) {
      emit(RequestsError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan filtrlar bilan qayta yuklaydi (pull-to-refresh,
  /// "Qayta urinish" tugmasi, yoki tafsilot sahifasidan qaytgach — u
  /// yerda javob/ball ro'yxatga ta'sir qilgan bo'lishi mumkin).
  Future<void> reload() => load(
    assignedOnly: _assignedOnly,
    status: _status,
    priority: _priority,
    query: _query,
  );
}
