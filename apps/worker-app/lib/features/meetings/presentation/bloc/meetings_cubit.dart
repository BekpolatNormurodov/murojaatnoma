import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/domain/usecases/get_meetings.dart';

part 'meetings_state.dart';

/// "Majlislar" ro'yxat sahifasini boshqaruvchi Cubit.
///
/// Joriy holat filtrini ichida saqlaydi — shu tufayli [reload]
/// (pull-to-refresh yoki tafsilot sahifasidan qaytgach) parametrsiz
/// chaqirilib, so'nggi ishlatilgan filtr bilan qayta so'rov yuboradi
/// (`RequestsCubit`/`ChatListCubit` bilan bir xil naqsh).
///
/// Hech qachon uncaught tashlamaydi — muvaffaqiyatsizlik har doim
/// [MeetingsError] holatiga aylanadi.
class MeetingsCubit extends Cubit<MeetingsState> {
  MeetingsCubit({required GetMeetings getMeetings})
    : _getMeetings = getMeetings,
      super(const MeetingsLoading());

  final GetMeetings _getMeetings;

  MeetingStatus? _status;

  MeetingStatus? get statusFilter => _status;

  /// Majlislar ro'yxatini (berilgan holat filtri bilan) yuklaydi. Har doim
  /// [MeetingsLoading] bilan boshlanadi — tab almashganda ham eski ro'yxat
  /// ustida "muzlab qolgan" holat ko'rinmaydi.
  Future<void> load({MeetingStatus? status}) async {
    _status = status;

    emit(const MeetingsLoading());
    try {
      final result = await _getMeetings(GetMeetingsParams(status: status));
      result.fold((failure) => emit(MeetingsError(failure.message)), (items) {
        emit(items.isEmpty ? const MeetingsEmpty() : MeetingsLoaded(items));
      });
    } on Object catch (e) {
      emit(MeetingsError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan filtr bilan qayta yuklaydi (pull-to-refresh,
  /// "Qayta urinish" tugmasi, yoki tafsilot sahifasidan qaytgach — u yerda
  /// qo'shilish ro'yxatga ta'sir qilgan bo'lishi mumkin).
  Future<void> reload() => load(status: _status);
}
