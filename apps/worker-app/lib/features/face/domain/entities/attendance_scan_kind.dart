/// `FaceCubit`ning liveness rejimi qaysi davomat harakati uchun
/// ishga tushirilganini bildiradi — `startLiveness(kind: ...)` orqali
/// belgilanadi va `_afterMatch` ichida `CheckIn`/`CheckOut`
/// usecase'laridan qaysi biri chaqirilishini tanlaydi.
///
/// Standart qiymat [checkIn] — mavjud check-in oqimi (Vazifa 17)
/// o'zgarishsiz qoladi, [checkOut] esa yangi "ketdi" oqimi (Vazifa 19)
/// uchun qo'shildi. Muvaffaqiyat/sarlavha matnini tanlash esa sahifa
/// (`FaceCheckinPage`) zimmasida — `FaceCubit` o'zi hech qanday UI
/// matniga bog'liq emas.
enum AttendanceScanKind {
  /// Ish kunini boshlash ("keldi").
  checkIn,

  /// Ish kunini yakunlash ("ketdi").
  checkOut,
}
