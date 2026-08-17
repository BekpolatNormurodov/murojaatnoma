part of 'meeting_detail_cubit.dart';

/// "Majlis tafsilotlari" sahifasining barcha holatlari.
sealed class MeetingDetailState extends Equatable {
  const MeetingDetailState();

  @override
  List<Object?> get props => [];
}

/// Majlis yuklanmoqda (yoki qayta yuklanmoqda — "Qayta urinish").
class MeetingDetailLoading extends MeetingDetailState {
  const MeetingDetailLoading();
}

/// Majlis muvaffaqiyatli yuklandi.
///
/// [joining] — "Majlisga ulanish" amali bajarilayotganda `true` (tugma shu
/// payt "Ulanmoqda…" ko'rsatadi), lekin sahifa o'zi almashtirilmaydi —
/// mavjud ma'lumot ustida ko'rsatiladi.
class MeetingDetailLoaded extends MeetingDetailState {
  const MeetingDetailLoaded({required this.meeting, this.joining = false});

  final Meeting meeting;
  final bool joining;

  MeetingDetailLoaded copyWith({Meeting? meeting, bool? joining}) {
    return MeetingDetailLoaded(
      meeting: meeting ?? this.meeting,
      joining: joining ?? this.joining,
    );
  }

  @override
  List<Object?> get props => [meeting, joining];
}

/// Majlisni yuklashda xatolik (masalan topilmadi/server xatosi) —
/// [message] "Qayta urinish" tugmasi bilan birga ko'rsatiladi.
class MeetingDetailError extends MeetingDetailState {
  const MeetingDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
