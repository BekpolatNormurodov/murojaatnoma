import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/domain/usecases/get_meeting.dart';
import 'package:worker_app/features/meetings/domain/usecases/join_meeting.dart';

part 'meeting_detail_state.dart';

/// "Majlis tafsilotlari" sahifasini boshqaruvchi Cubit — bitta majlisni
/// yuklaydi va unga qo'shiladi (join).
///
/// Hech qachon uncaught tashlamaydi: [load] muvaffaqiyatsizligi
/// [MeetingDetailError] holatiga aylanadi; [join] muvaffaqiyatsizligi esa
/// joriy [MeetingDetailLoaded]ni saqlab qolgan holda xatolik matnini
/// qaytaradi (`Future<String?>` — `null` bo'lsa muvaffaqiyatli) —
/// chaqiruvchi (sahifa) buni to'g'ridan-to'g'ri `AppAlert` orqali
/// ko'rsatadi (`RequestDetailCubit.respond`/`rate` bilan bir xil naqsh:
/// holat pipeline'iga aralashmaydigan bitta martalik natija).
class MeetingDetailCubit extends Cubit<MeetingDetailState> {
  MeetingDetailCubit({
    required GetMeeting getMeeting,
    required JoinMeeting joinMeeting,
  }) : _getMeeting = getMeeting,
       _joinMeeting = joinMeeting,
       super(const MeetingDetailLoading());

  final GetMeeting _getMeeting;
  final JoinMeeting _joinMeeting;

  /// So'nggi [load] bilan chaqirilgan ID — [retry] parametrsiz qayta
  /// yuklay olishi uchun saqlanadi.
  String? _lastId;

  Future<void> load(String id) async {
    _lastId = id;
    emit(const MeetingDetailLoading());
    try {
      final result = await _getMeeting(GetMeetingParams(id));
      result.fold(
        (failure) => emit(MeetingDetailError(failure.message)),
        (meeting) => emit(MeetingDetailLoaded(meeting: meeting)),
      );
    } on Object catch (e) {
      emit(MeetingDetailError('Kutilmagan xatolik: $e'));
    }
  }

  /// So'nggi ishlatilgan ID bilan qayta yuklaydi ("Qayta urinish").
  Future<void> retry() {
    final id = _lastId;
    return id == null ? Future<void>.value() : load(id);
  }

  /// Majlisga qo'shiladi (join URL bilan yangilangan majlisni oladi).
  ///
  /// Qaytadi: `null` — muvaffaqiyatli; aks holda — ko'rsatiladigan
  /// xatolik matni.
  Future<String?> join() async {
    final current = state;
    if (current is! MeetingDetailLoaded) {
      return 'Majlis hali yuklanmagan';
    }
    emit(current.copyWith(joining: true));
    try {
      final result = await _joinMeeting(JoinMeetingParams(current.meeting.id));
      return result.fold(
        (failure) {
          emit(current.copyWith(joining: false));
          return failure.message;
        },
        (updated) {
          emit(MeetingDetailLoaded(meeting: updated));
          return null;
        },
      );
    } on Object catch (e) {
      emit(current.copyWith(joining: false));
      return 'Kutilmagan xatolik: $e';
    }
  }
}
