import 'package:equatable/equatable.dart';

/// `POST /attendance/check-in` yoki `/attendance/check-out` muvaffaqiyatli
/// javobi (`AttendanceRecord`) — SERVER yuz moslikni (`embedding` orqali)
/// hisoblab, shu natijani qaytaradi. Mahalliy moslik (`FaceMatcher`) endi
/// jonli oqimda ishlatilmaydi — bu klass server qarorining o'zi.
///
/// [type] — `'CHECK_IN'` yoki `'CHECK_OUT'` (backend qaysi so'rov
/// bajarilganini aytadi — chaqiruvchi buni allaqachon bilgani uchun
/// odatda ishlatilmaydi, lekin kontraktning bir qismi sifatida saqlanadi).
class CheckScanResult extends Equatable {
  const CheckScanResult({
    required this.isValid,
    required this.faceScore,
    required this.type,
    required this.isLate,
    required this.lateMinutes,
    required this.recordedAt,
    this.reason,
  });

  factory CheckScanResult.fromJson(Map<String, dynamic> json) {
    return CheckScanResult(
      isValid: json['isValid'] as bool? ?? false,
      faceScore: (json['faceScore'] as num?)?.toDouble() ?? 0,
      reason: json['reason'] as String?,
      type: json['type'] as String? ?? '',
      isLate: json['isLate'] as bool? ?? false,
      lateMinutes: (json['lateMinutes'] as num?)?.toInt() ?? 0,
      // `recordedAt` — backend hujjatida har doim mavjud; agar
      // parslanmasa (kutilmagan shakl) joriy vaqtga tushiriladi — bu
      // yerda `null`ga tushishdan ko'ra xavfsizroq (chaqiruvchilar buni
      // "hozir" sifatida ko'rsatishi mumkin, qarang: `FaceCubit`).
      recordedAt:
          DateTime.tryParse(json['recordedAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  /// Server tomonidan hisoblangan moslik >= chegara (odatda 0.7) bo'lib,
  /// yozuv haqiqiy deb qabul qilinganini bildiradi.
  final bool isValid;

  /// Server hisoblagan kosinus o'xshashlik balli (odatda `0.0..1.0`).
  final double faceScore;

  /// `isValid == false` bo'lganda sabab matni (masalan "yuz mos
  /// kelmadi") — aks holda odatda `null`.
  final String? reason;

  /// `'CHECK_IN'` | `'CHECK_OUT'`.
  final String type;

  /// Ish boshlanish vaqtidan kech qolinganmi (faqat check-in uchun
  /// ma'noli — check-out javobida odatda `false`).
  final bool isLate;

  /// Necha daqiqa kech qolingani (`isLate == false` bo'lsa `0`).
  final int lateMinutes;

  /// Yozuv server tomonidan qachon qayd etilgani.
  final DateTime recordedAt;

  @override
  List<Object?> get props => [
    isValid,
    faceScore,
    reason,
    type,
    isLate,
    lateMinutes,
    recordedAt,
  ];
}
