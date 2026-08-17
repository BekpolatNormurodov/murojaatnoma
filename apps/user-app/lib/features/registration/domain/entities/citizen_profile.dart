import 'package:equatable/equatable.dart';

/// Fuqaro shaxsiy hujjatining turi — JSHSHIR (PINFL) yoki pasport
/// seriya/raqami orqali identifikatsiya.
enum DocumentType { pinfl, passport }

/// OTP tasdiqlangandan keyin, yuz/PIN bosqichlaridan OLDIN to'ldiriladigan
/// fuqaro shaxsiy ma'lumotlari (Faza 3: ro'yxatdan o'tish).
///
/// `worker_app`dagi tegishli entity'lar bilan bir xil naqsh — Equatable +
/// JSON serializatsiya (`fromJson`/`toJson`), xavfsiz lokal xotirada bitta
/// JSON hujjat sifatida saqlanadi (qarang:
/// `data/datasources/registration_local_data_source.dart`).
class CitizenProfile extends Equatable {
  const CitizenProfile({
    required this.fullName,
    required this.documentType,
    required this.documentNumber,
    required this.birthDate,
    required this.regionCode,
    required this.districtCode,
    required this.address,
  });

  factory CitizenProfile.fromJson(Map<String, dynamic> json) {
    return CitizenProfile(
      fullName: json['full_name'] as String,
      documentType: DocumentType.values.byName(
        json['document_type'] as String,
      ),
      documentNumber: json['document_number'] as String,
      birthDate: json['birth_date'] as String,
      regionCode: json['region_code'] as String,
      districtCode: json['district_code'] as String,
      address: json['address'] as String,
    );
  }

  /// To'liq ism (F.I.Sh.).
  final String fullName;

  /// Qaysi hujjat orqali identifikatsiya qilingani.
  final DocumentType documentType;

  /// [documentType]ga qarab: 14 xonali JSHSHIR YOKI pasport seriya+raqami
  /// (masalan `AA1234567`).
  final String documentNumber;

  /// Tug'ilgan sana, ISO `yyyy-MM-dd` ko'rinishida saqlanadi (`CitizenRequest
  /// .createdAt` bilan bir xil ISO-satr konvensiyasi).
  final String birthDate;

  /// Viloyat kodi — qarang: `domain/entities/region.dart`dagi
  /// `kUzbekistanRegions`.
  final String regionCode;

  /// Tuman kodi — tanlangan [regionCode]ning `districtCodes` ro'yxatidan.
  final String districtCode;

  /// Yashash manzili (erkin matn).
  final String address;

  @override
  List<Object?> get props => [
    fullName,
    documentType,
    documentNumber,
    birthDate,
    regionCode,
    districtCode,
    address,
  ];

  Map<String, dynamic> toJson() => {
    'full_name': fullName,
    'document_type': documentType.name,
    'document_number': documentNumber,
    'birth_date': birthDate,
    'region_code': regionCode,
    'district_code': districtCode,
    'address': address,
  };
}
