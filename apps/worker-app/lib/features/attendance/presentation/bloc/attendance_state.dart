part of 'attendance_cubit.dart';

/// Bosh sahifa (davomat) dashboard'ining barcha holatlari.
///
/// `sealed` — `HomePage`dagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni ko'rsatishni
/// unutib qoldirish kompilyatsiya xatosiga aylanadi — "error kkmas
/// umuman" mandatining bir qismi.
sealed class AttendanceState extends Equatable {
  const AttendanceState();

  @override
  List<Object?> get props => [];
}

/// `load()` boshlanganda (yoki qayta yuklanganda) — sahifa skeleton/shimmer
/// ko'rsatadi, HECH QACHON oq/bo'sh ekran emas.
class AttendanceLoading extends AttendanceState {
  const AttendanceLoading();
}

/// Davomat tarixi muvaffaqiyatli yuklandi.
///
/// [today] — sanasi bugungi kunga mos keluvchi yozuv; hech qanday yozuv
/// topilmasa `null` ("hali belgilanmagan" — bu ATAYLAB `AttendanceStatus`
/// qiymatlaridan biriga (masalan `absent`) sintez qilinmaydi, chunki
/// "hali check-in qilmadi" va "kelmadi deb belgilandi" semantik jihatdan
/// boshqa-boshqa narsa; UI ikkalasini alohida ko'rsatadi — qarang:
/// `TodayStatusCard`).
///
/// [week] — tarixning oxirgi (sana bo'yicha o'sish tartibida) 7 tagacha
/// yozuvi — `WeeklyMiniChart` shuni chizadi.
class AttendanceLoaded extends AttendanceState {
  const AttendanceLoaded({required this.today, required this.week});

  final AttendanceDay? today;
  final List<AttendanceDay> week;

  @override
  List<Object?> get props => [today, week];
}

/// `AttendanceRepository.history()` bo'sh ro'yxat qaytardi — ishchida
/// hali umuman davomat yozuvi yo'q (masalan yangi ishga qabul qilingan).
class AttendanceEmpty extends AttendanceState {
  const AttendanceEmpty();
}

/// `history()` `Left(Failure)` qaytardi (yoki kutilmagan istisno) —
/// [message] "Qayta urinish" tugmasi bilan ko'rsatiladi.
class AttendanceError extends AttendanceState {
  const AttendanceError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
