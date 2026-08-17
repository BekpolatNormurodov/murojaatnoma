/// Bitta viloyat (yoki Toshkent shahri/Qoraqalpog'iston Respublikasi) —
/// kodi va unga tegishli tuman kodlari.
///
/// Sof ma'lumot (Flutter/l10n'ga bog'liq emas — domen qatlamida xavfsiz) —
/// nomlarni ko'rsatish uchun l10n-mos yorliqlar
/// `presentation/widgets/region_meta.dart`da (`UtilityTypeMeta` bilan bir
/// xil naqsh) alohida saqlanadi.
class Region {
  const Region({required this.code, required this.districtCodes});

  final String code;
  final List<String> districtCodes;
}

/// O'zbekistonning barcha 14 ta birinchi darajali ma'muriy birligi — har
/// biri uchun KICHIK (mock) tumanlar ro'yxati bilan.
///
/// Ro'yxat TO'LIQ (barcha 14 viloyat/shahar/respublika bor — fuqaro o'z
/// viloyatini har doim topa oladi), lekin har bir viloyat ichidagi tumanlar
/// ATAYLAB qisqartirilgan (mock/namunaviy, real to'liq ma'lumotnoma emas —
/// vazifa qamrovi shuni talab qiladi).
const List<Region> kUzbekistanRegions = [
  Region(code: 'toshkent_shahri', districtCodes: ['chilonzor', 'yunusobod']),
  Region(code: 'toshkent_viloyati', districtCodes: ['zangiota', 'qibray']),
  Region(code: 'andijon', districtCodes: ['andijon_shahri', 'asaka']),
  Region(code: 'fargona', districtCodes: ['fargona_shahri', 'qoqon']),
  Region(code: 'namangan', districtCodes: ['namangan_shahri', 'chust']),
  Region(code: 'samarqand', districtCodes: ['samarqand_shahri', 'urgut']),
  Region(code: 'buxoro', districtCodes: ['buxoro_shahri', 'gijduvon']),
  Region(code: 'xorazm', districtCodes: ['urganch', 'xiva']),
  Region(code: 'navoiy', districtCodes: ['navoiy_shahri', 'zarafshon']),
  Region(code: 'qashqadaryo', districtCodes: ['qarshi', 'shahrisabz']),
  Region(code: 'surxondaryo', districtCodes: ['termiz', 'denov']),
  Region(code: 'jizzax', districtCodes: ['jizzax_shahri', 'zomin']),
  Region(code: 'sirdaryo', districtCodes: ['guliston', 'shirin']),
  Region(code: 'qoraqalpogiston', districtCodes: ['nukus', 'xojayli']),
];
