import 'package:equatable/equatable.dart';

/// Fuqaro shaxsiy hujjatining turi — JSHSHIR (PINFL) yoki pasport
/// seriya/raqami orqali identifikatsiya.
enum DocumentType { pinfl, passport }

/// OTP tasdiqlangandan keyin, yuz/PIN bosqichlaridan OLDIN to'ldiriladigan
/// fuqaro shaxsiy ma'lumotlari (Faza 3: ro'yxatdan o'tish).
///
/// **Faqat [fullName] majburiy.** Murojaat (`/applications`) yuborish
/// uchun kerakli yagona narsa — telefon (OTP orqali allaqachon
/// tasdiqlangan) va F.I.Sh. (qarang: `CitizenRequestsApiImpl
/// ._currentFullName`, murojaat "muallif" nomini AYNAN shu maydondan
/// oladi). Qolgan barcha maydonlar (hujjat turi/raqami, tug'ilgan sana,
/// viloyat/tuman, manzil) — IXTIYORIY: fuqaro murojaat yuborish uchun
/// pasport/JSHSHIR ko'rsatishga MAJBUR emas (`registration_page.dart`da
/// "Qo'shimcha ma'lumot" bo'limi sifatida, yashiringan holda taklif
/// qilinadi). Hech biri hech qayerda (murojaat yuborish, profil
/// ko'rsatish) ISHLATILMAYDI — faqat kelajakda kerak bo'lsa deb
/// saqlanadi, shuning uchun ularni talab qilish faqat ortiqcha
/// to'siq bo'lardi.
///
/// `worker_app`dagi tegishli entity'lar bilan bir xil naqsh — Equatable +
/// JSON serializatsiya (`fromJson`/`toJson`), xavfsiz lokal xotirada bitta
/// JSON hujjat sifatida saqlanadi (qarang:
/// `data/datasources/registration_local_data_source.dart`).
class CitizenProfile extends Equatable {
  const CitizenProfile({
    required this.fullName,
    this.documentType,
    this.documentNumber,
    this.birthDate,
    this.regionCode,
    this.districtCode,
    this.address,
  });

  /// **Diqqat**: bu factory kelayotgan [json] ALLAQACHON tekshirilgan
  /// (to'g'ri shaklda) deb faraz qiladi — shakl tekshiruvining o'zi
  /// chaqiruvchida (`RegistrationLocalDataSourceImpl.read()`) amalga
  /// oshiriladi, bu yerdagi `as` cast'lari esa faqat ICHKI xavfsizlik
  /// to'ri (noto'g'ri shaklda chaqirilsa `TypeError` tashlaydi).
  factory CitizenProfile.fromJson(Map<String, dynamic> json) {
    final documentType = json['document_type'];
    return CitizenProfile(
      fullName: json['full_name'] as String,
      documentType: documentType == null
          ? null
          : DocumentType.values.byName(documentType as String),
      documentNumber: json['document_number'] as String?,
      birthDate: json['birth_date'] as String?,
      regionCode: json['region_code'] as String?,
      districtCode: json['district_code'] as String?,
      address: json['address'] as String?,
    );
  }

  /// To'liq ism (F.I.Sh.) — YAGONA majburiy maydon.
  final String fullName;

  /// Qaysi hujjat orqali identifikatsiya qilingani — fuqaro "Qo'shimcha
  /// ma'lumot" bo'limini to'ldirmagan bo'lsa `null` (IXTIYORIY).
  final DocumentType? documentType;

  /// [documentType]ga qarab: 14 xonali JSHSHIR YOKI pasport seriya+raqami
  /// (masalan `AA1234567`) — IXTIYORIY, faqat [documentType] bilan
  /// BIRGA (ikkalasi ham `null` yoki ikkalasi ham to'ldirilgan).
  final String? documentNumber;

  /// Tug'ilgan sana, ISO `yyyy-MM-dd` ko'rinishida saqlanadi (`CitizenRequest
  /// .createdAt` bilan bir xil ISO-satr konvensiyasi) — IXTIYORIY.
  final String? birthDate;

  /// Viloyat kodi — qarang: `domain/entities/region.dart`dagi
  /// `kUzbekistanRegions` — IXTIYORIY.
  final String? regionCode;

  /// Tuman kodi — tanlangan [regionCode]ning `districtCodes` ro'yxatidan —
  /// IXTIYORIY.
  final String? districtCode;

  /// Yashash manzili (erkin matn) — IXTIYORIY.
  final String? address;

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

  /// `null` maydonlar butunlay TUSHIRILADI (kalit ham yozilmaydi) —
  /// `RegistrationLocalDataSourceImpl.read()` yo'q kalitni `null` qiymat
  /// bilan bir xil talqin qiladi, shuning uchun bu ikki shakl (kalit yo'q
  /// / kalit `null`) o'qishda farqsiz, lekin saqlangan JSON ixchamroq.
  Map<String, dynamic> toJson() => {
    'full_name': fullName,
    if (documentType != null) 'document_type': documentType!.name,
    if (documentNumber != null) 'document_number': documentNumber,
    if (birthDate != null) 'birth_date': birthDate,
    if (regionCode != null) 'region_code': regionCode,
    if (districtCode != null) 'district_code': districtCode,
    if (address != null) 'address': address,
  };
}
