part of 'map_cubit.dart';

/// "Xarita" (hudud kuzatuvi) ekranining barcha holatlari.
///
/// `sealed` — `MapPage`dagi `switch` ifodasi compiler tomonidan to'liq
/// (exhaustive) tekshiriladi: yangi holat qo'shilsa, uni ko'rsatishni
/// unutib qoldirish kompilyatsiya xatosiga aylanadi (`AttendanceState`
/// bilan bir xil naqsh — qarang: `attendance_state.dart`).
sealed class MapState extends Equatable {
  const MapState();

  @override
  List<Object?> get props => [];
}

/// Boshlang'ich holat — `start()` hali chaqirilmagan, YOKI `stop()` bitta
/// ham pozitsiya kelmasdan turib chaqirilgan (ko'rsatadigan "muzlatiladigan"
/// narsa yo'q). `MapPage` bu holatda ham xaritani (geofence doirasi bilan)
/// ko'rsatadi, faqat jonli marker/iz yo'q — foydalanuvchi "Kuzatishni
/// boshlash" tugmasi bilan qayta yoqadi.
///
/// Kuzatuv KAMIDA bitta pozitsiya qabul qilgandan KEYIN to'xtatilsa, buning
/// o'rniga [MapStopped] qaytadi — qarang: undagi izoh.
class MapInitial extends MapState {
  const MapInitial();
}

/// Joylashuv xizmati o'chirilgan yoki ruxsat rad etilgan (denied/
/// deniedForever) — `AttendanceCubit._defaultLocate` bilan bir xil
/// tekshiruv, lekin bu yerda alohida holat sifatida modellashtirilgan
/// (chaqiruvchi `null` emas), chunki `MapPage` doimiy ravishda ushbu
/// holatni "Ruxsat berish" CTA bilan ko'rsatishi kerak.
///
/// [permanentlyDenied] — foydalanuvchi ruxsatni doimiy rad etgan bo'lsa
/// (`LocationPermission.deniedForever`) `true`: OS endi qayta so'rash
/// oynasini ko'rsatmaydi, faqat tizim sozlamalaridan (`openAppSettings()`)
/// yoqish mumkin — `FacePermissionDenied` (`face_state.dart`) bilan BIR
/// XIL naqsh.
class MapPermissionDenied extends MapState {
  const MapPermissionDenied({this.permanentlyDenied = false});

  final bool permanentlyDenied;

  @override
  List<Object?> get props => [permanentlyDenied];
}

/// `start()` chaqirilgandan so'ng, ruxsat tekshirilayotganda va birinchi
/// pozitsiya kutilayotganda — sahifa xaritani (geofence bilan) ko'rsatadi,
/// pastda "aniqlanmoqda" belgisi bilan. HECH QACHON oq/bo'sh ekran emas.
class MapLoading extends MapState {
  const MapLoading();
}

/// Kuzatuv faol — oqim hech bo'lmaganda bitta pozitsiya bergan.
///
/// [position] — eng so'nggi qabul qilingan joylashuv.
/// [trail] — shu kuzatuv sessiyasi davomida to'plangan barcha nuqtalar
/// ("breadcrumb" izi), qabul qilingan tartibda — [MapCubit.start] har safar
/// bo'shatiladi.
/// [insideGeofence] — [position] `GeofenceService.isInside` bo'yicha ish
/// hududi ichidami.
class MapTracking extends MapState {
  const MapTracking({
    required this.position,
    required this.trail,
    required this.insideGeofence,
  });

  final Position position;
  final List<LatLng> trail;
  final bool insideGeofence;

  @override
  List<Object?> get props => [position, trail, insideGeofence];
}

/// Kuzatuv foydalanuvchi tomonidan ATAYLAB to'xtatildi ([MapCubit.stop]),
/// lekin oldin KAMIDA bitta pozitsiya qabul qilingan edi — oxirgi ma'lum
/// [position]/[trail]/[insideGeofence] shu yerda "muzlatilgan" holda
/// saqlanadi, shunda `MapPage` marker va breadcrumb izini yo'qotib
/// yubormaydi (`MapInitial`ga o'tib ketilsa, ikkalasi ham butunlay
/// yo'qolib qolardi — foydalanuvchiga "tugma hech narsa qilmayapti" deb
/// tuyulishi mumkin edi).
///
/// [MapInitial]dan farqi: [MapInitial] — HECH QACHON kuzatilmagan (yoki
/// pozitsiyasiz to'xtatilgan); [MapStopped] — kuzatilgan, lekin hozir
/// TO'XTATILGAN. `MapPage`da tugma ikkalasida ham "Kuzatishni boshlash"ni
/// ko'rsatadi ([MapCubit.start] ikkalasidan ham qayta boshlay oladi).
class MapStopped extends MapState {
  const MapStopped({
    required this.position,
    required this.trail,
    required this.insideGeofence,
  });

  final Position position;
  final List<LatLng> trail;
  final bool insideGeofence;

  @override
  List<Object?> get props => [position, trail, insideGeofence];
}

/// Ruxsat tekshiruvi yoki joylashuv oqimi kutilmagan xato bilan yakunlandi
/// (masalan xizmat to'xtadi) — [message] "Qayta urinish" tugmasi bilan
/// ko'rsatiladi. Hech qachon uncaught tashlanmaydi — qarang: `MapCubit`.
class MapError extends MapState {
  const MapError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
