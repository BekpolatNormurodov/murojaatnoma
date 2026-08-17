import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_requests.dart';

part 'requests_state.dart';

/// "Murojaatlarim" (Arizalar tabi) ro'yxat sahifasini boshqaruvchi Cubit.
///
/// Joriy filtrlarni (`kind`/`status`/`query`) ichida saqlaydi — shu
/// tufayli [reload] (pull-to-refresh, "Qayta urinish" yoki detail/yuborish
/// sahifasidan qaytgach) parametrsiz chaqirilib, so'nggi ishlatilgan
/// filtrlar bilan qayta so'rov yuboradi.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [RequestsError] holatiga aylanadi.
class RequestsCubit extends Cubit<RequestsState> {
  RequestsCubit({required GetCitizenRequests getCitizenRequests})
    : _getCitizenRequests = getCitizenRequests,
      super(const RequestsLoading());

  final GetCitizenRequests _getCitizenRequests;

  RequestKind _kind = RequestKind.ariza;
  RequestStatus? _status;
  String? _query;

  RequestKind get kind => _kind;
  RequestStatus? get statusFilter => _status;
  String? get query => _query;

  /// `true` bo'lsa holat filtri tanlangan — filtr tugmasining faol-holat
  /// ko'rsatkichi uchun.
  bool get hasActiveFilters => _status != null;

  /// Murojaatlar ro'yxatini (berilgan filtrlar bilan) yuklaydi. Har doim
  /// [RequestsLoading] bilan boshlanadi — tab/qidiruv/filtr almashganda
  /// ham eski ro'yxat ustida "muzlab qolgan" holat ko'rinmaydi.
  Future<void> load({
    required RequestKind kind,
    RequestStatus? status,
    String? query,
  }) async {
    _kind = kind;
    _status = status;
    _query = query;

    emit(const RequestsLoading());
    try {
      final result = await _getCitizenRequests(
        GetCitizenRequestsParams(kind: kind, status: status, query: query),
      );
      result.fold((failure) => emit(RequestsError(failure.message)), (items) {
        emit(items.isEmpty ? const RequestsEmpty() : RequestsLoaded(items));
      });
    } on Object catch (e) {
      emit(RequestsError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan filtrlar bilan qayta yuklaydi (pull-to-refresh,
  /// "Qayta urinish" tugmasi, yoki detail/yuborish sahifasidan qaytgach —
  /// u yerda yangi murojaat ro'yxatga ta'sir qilgan bo'lishi mumkin).
  Future<void> reload() => load(kind: _kind, status: _status, query: _query);
}
