import 'package:app_core/app_core.dart';

/// Viloyat/tuman KODlarini l10n-mos ko'rinadigan yorliqlarga o'giradi —
/// `UtilityTypeMeta`/`RequestKindMeta` bilan bir xil naqsh (markazlashtirilgan
/// kod->yorliq xaritasi, shuning uchun barcha ekranlarda bir xil nom).
///
/// `code` haqiqiy `String` (enum emas) bo'lgani uchun compiler switch'ning
/// to'liqligini isbotlay olmaydi — shu sababli har ikkala metodda ham
/// himoya sifatida `_ => code` standart holati bor (amalda hech qachon
/// yetib bo'lmaydi, chunki `code` doim `kUzbekistanRegions`dan keladi).
abstract class RegionMeta {
  static String regionLabel(AppLocalizations l10n, String code) =>
      switch (code) {
        'toshkent_shahri' => l10n.registrationRegionToshkentShahri,
        'toshkent_viloyati' => l10n.registrationRegionToshkentViloyati,
        'andijon' => l10n.registrationRegionAndijon,
        'fargona' => l10n.registrationRegionFargona,
        'namangan' => l10n.registrationRegionNamangan,
        'samarqand' => l10n.registrationRegionSamarqand,
        'buxoro' => l10n.registrationRegionBuxoro,
        'xorazm' => l10n.registrationRegionXorazm,
        'navoiy' => l10n.registrationRegionNavoiy,
        'qashqadaryo' => l10n.registrationRegionQashqadaryo,
        'surxondaryo' => l10n.registrationRegionSurxondaryo,
        'jizzax' => l10n.registrationRegionJizzax,
        'sirdaryo' => l10n.registrationRegionSirdaryo,
        'qoraqalpogiston' => l10n.registrationRegionQoraqalpogiston,
        _ => code,
      };

  static String districtLabel(AppLocalizations l10n, String code) =>
      switch (code) {
        'chilonzor' => l10n.registrationDistrictChilonzor,
        'yunusobod' => l10n.registrationDistrictYunusobod,
        'zangiota' => l10n.registrationDistrictZangiota,
        'qibray' => l10n.registrationDistrictQibray,
        'andijon_shahri' => l10n.registrationDistrictAndijonShahri,
        'asaka' => l10n.registrationDistrictAsaka,
        'fargona_shahri' => l10n.registrationDistrictFargonaShahri,
        'qoqon' => l10n.registrationDistrictQoqon,
        'namangan_shahri' => l10n.registrationDistrictNamanganShahri,
        'chust' => l10n.registrationDistrictChust,
        'samarqand_shahri' => l10n.registrationDistrictSamarqandShahri,
        'urgut' => l10n.registrationDistrictUrgut,
        'buxoro_shahri' => l10n.registrationDistrictBuxoroShahri,
        'gijduvon' => l10n.registrationDistrictGijduvon,
        'urganch' => l10n.registrationDistrictUrganch,
        'xiva' => l10n.registrationDistrictXiva,
        'navoiy_shahri' => l10n.registrationDistrictNavoiyShahri,
        'zarafshon' => l10n.registrationDistrictZarafshon,
        'qarshi' => l10n.registrationDistrictQarshi,
        'shahrisabz' => l10n.registrationDistrictShahrisabz,
        'termiz' => l10n.registrationDistrictTermiz,
        'denov' => l10n.registrationDistrictDenov,
        'jizzax_shahri' => l10n.registrationDistrictJizzaxShahri,
        'zomin' => l10n.registrationDistrictZomin,
        'guliston' => l10n.registrationDistrictGuliston,
        'shirin' => l10n.registrationDistrictShirin,
        'nukus' => l10n.registrationDistrictNukus,
        'xojayli' => l10n.registrationDistrictXojayli,
        _ => code,
      };
}
