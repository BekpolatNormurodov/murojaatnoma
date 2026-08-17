import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/usecases/get_citizen_request.dart';

part 'request_detail_state.dart';

/// "Murojaat tafsilotlari" sahifasini boshqaruvchi Cubit — bitta ariza/
/// shikoyatni ID bo'yicha yuklaydi.
///
/// Faqat O'QISH — fuqaro o'z murojaatiga javob yozmaydi/ball qo'ymaydi
/// (bu — xodim tomonidagi amal), shuning uchun worker-app'dagi
/// `RequestDetailCubit`dan farqli, mutatsiya metodlari yo'q.
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [RequestDetailError] holatiga aylanadi.
class RequestDetailCubit extends Cubit<RequestDetailState> {
  RequestDetailCubit({required GetCitizenRequest getCitizenRequest})
    : _getCitizenRequest = getCitizenRequest,
      super(const RequestDetailLoading());

  final GetCitizenRequest _getCitizenRequest;

  /// So'nggi [load] bilan chaqirilgan ID — [retry] parametrsiz qayta
  /// yuklay olishi uchun saqlanadi.
  String? _lastId;

  Future<void> load(String id) async {
    _lastId = id;
    emit(const RequestDetailLoading());
    try {
      final result = await _getCitizenRequest(GetCitizenRequestParams(id));
      result.fold(
        (failure) => emit(RequestDetailError(failure.message)),
        (request) => emit(RequestDetailLoaded(request)),
      );
    } on Object catch (e) {
      emit(RequestDetailError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan ID bilan qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _lastId;
    return id == null ? Future<void>.value() : load(id);
  }
}
