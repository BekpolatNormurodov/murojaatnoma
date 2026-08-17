import 'package:equatable/equatable.dart';

/// `CheckIn` va `CheckOut` usecase'lari birgalikda ishlatadigan kirish
/// parametrlari — jonli backend kontraktiga ANIQ mos keladi: faqat
/// SERVER yuzni moslashtirishi uchun kerak bo'lgan probe embedding va
/// joriy koordinata.
///
/// Eski `CheckInParams`dan farqi: `employeeId` YO'Q (server buni JWT'dan
/// oladi) va `screenshotPath` YO'Q (backend kontraktida bunday maydon
/// yo'q — mahalliy davomat-isboti kerak bo'lsa, buni chaqiruvchi
/// (`FaceCubit`) o'zi alohida saqlaydi, bu usecase'ga bog'liq emas).
class AttendanceScanParams extends Equatable {
  const AttendanceScanParams({
    required this.embedding,
    required this.latitude,
    required this.longitude,
  });

  /// Liveness tugagach hisoblangan probe yuz embeddingi.
  final List<double> embedding;
  final double latitude;
  final double longitude;

  @override
  List<Object?> get props => [embedding, latitude, longitude];
}
