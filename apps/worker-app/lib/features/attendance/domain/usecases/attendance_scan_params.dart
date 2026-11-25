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
    required this.latitude,
    required this.longitude,
    this.embedding,
    this.photoUrl,
    this.accuracy,
  });

  /// Liveness tugagach hisoblangan probe yuz embeddingi.
  ///
  /// `null` — admin yuz skanerini O'CHIRGAN (`faceRequired == false`):
  /// so'rov faqat joylashuv bilan yuboriladi (server ham faqat joy
  /// bo'yicha tekshiradi).
  final List<double>? embedding;
  final double latitude;
  final double longitude;

  /// GPS aniqligi (metr) — server ixtiyoriy qabul qiladi.
  final double? accuracy;

  /// Yuz tekshiruvidan o'tgan kadr (oldin `/uploads`ga yuklangan) — server
  /// davomat yozuviga "kim keldi" isboti sifatida saqlaydi.
  final String? photoUrl;

  @override
  List<Object?> get props => [
    embedding,
    latitude,
    longitude,
    photoUrl,
    accuracy,
  ];
}
