import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:latlong2/latlong.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:worker_app/core/constants/app_constants.dart';
import 'package:worker_app/features/map/data/yandex_map.dart';
import 'package:worker_app/features/map/data/zone_boundary_loader.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// Tayl so'rovlaridagi identifikator (`User-Agent`).
const _tileUserAgentPackageName = 'uz.gov.hokimiyat.worker_app';

/// Biriktirilgan hududlar (admin o'zgartirsa) shu oraliqda yangilanadi.
const _zoneRefreshInterval = Duration(minutes: 2);

/// Ish joyi markazi — geofence doirasi va xaritaning boshlang'ich markazi
/// shu nuqtaga asoslanadi.
const _workplaceCenter = LatLng(kWorkplaceLat, kWorkplaceLng);
// Tuman miqyosidagi ish hududi (2 km radius) doirasi to'liq ko'rinishi uchun
// pastroq zoom (ilgari 16 — ko'cha darajasi, katta doira sig'masdi).
const _defaultZoom = 13.5;

/// Ish kuni boshlanish/tugash soati (24 soatlik) — Dushanba–Shanba
/// 09:00–18:00 (qarang: `WorkSchedulePage` — bosh sahifadagi haftalik
/// jadval BIR XIL soatlarni ko'rsatadi). Yakshanba dam olish kuni.
const _workDayStartHour = 9;
const _workDayEndHour = 18;

/// Hozir (`DateTime.now()`) ish vaqtimi — Dushanba–Shanba, 09:00–18:00
/// oralig'ida. MOCK/dizayn qoidasi — real backend jadvaliga bog'liq emas.
bool _isWithinWorkHours(DateTime now) {
  if (now.weekday == DateTime.sunday) return false;
  return now.hour >= _workDayStartHour && now.hour < _workDayEndHour;
}

/// "Xarita" (hudud kuzatuvi) tabi — jonli joylashuv, "breadcrumb" izi va
/// geofence vizualizatsiyasi.
///
/// Butun holat/biznes-mantiq `MapCubit`da (qarang: `map_cubit.dart`); bu
/// sahifa faqat uni ko'rsatadi va ikkita sof UI-darajali narsani boshqaradi:
/// `MapController` (kamera pozitsiyasi/zoom) va "birinchi pozitsiyada bir
/// marta markazlashtirish" bayrog'i. Kuzatuv router darajasida avtomatik
/// boshlanadi (`getIt<MapCubit>()..start()` — `AttendanceCubit`ning
/// `..load()` bilan bir xil naqsh, qarang: `app_router.dart`).
class MapPage extends StatefulWidget {
  const MapPage({super.key});

  @override
  State<MapPage> createState() => _MapPageState();
}

class _MapPageState extends State<MapPage> with WidgetsBindingObserver {
  final _mapController = MapController();
  final _loader = ZoneBoundaryLoader(getIt<DioClient>().dio);
  Timer? _zoneRefreshTimer;

  /// Biriktirilgan mahalla kodlari (oxirgi `/locations/me`) — o'zgarsa
  /// chegaralar qayta chiziladi.
  Set<String> _assignedCodes = const {};

  /// `FlutterMap` HOZIR chizilganmi (`onMapReady` keldi) — `MapController`
  /// faqat shunda ishlaydi. Ruxsat/xato ekranida xarita yo'q.
  bool _mapReady = false;

  /// Kamera tumanga bir marta moslandi — keyingi yangilanishlarda xodim
  /// surgan kamerani "tortib" olmaymiz.
  bool _districtFitted = false;

  /// Oxirgi GPS fiksining aniqligi (m) — chegara tolerantligi uchun.
  double _lastAccuracy = 0;

  /// Joriy kuzatuv sessiyasida kamera birinchi qabul qilingan pozitsiyaga
  /// ALLAQACHON markazlashtirilganmi. Faqat BIR MARTA avtomatik
  /// markazlashtiradi — aks holda foydalanuvchi xaritani qo'lda surganda
  /// har yangi pozitsiyada kamera "sudralib" tirishqoqlik qilardi.
  /// `MapInitial`ga qaytilganda (kuzatuv to'xtatilganda) qayta `false`ga
  /// tushadi, shunda keyingi sessiya yana bir marta markazlashadi.
  bool _centeredOnFirstFix = false;

  /// Tuman + mahalla chegaralari (backend `/zones` dan) — bir marta yuklanadi.
  /// Endi biriktirilgan mahalla kodlari bilan yuklanadi (qarang:
  /// [_loadBoundaries]) — biriktirilgan mahallalar "Ish hududi" bo'lib yashil
  /// chiziladi.
  ZoneBoundaries _boundaries = ZoneBoundaries.empty;

  /// Foydalanuvchi HOZIR ichida bo'lgan mahalla (lokal ray-casting natijasi) —
  /// `null` bo'lsa tuman tashqarisida (yoki chegaralar hali yuklanmagan).
  /// Faqat pozitsiya sezilarli o'zgarganda qayta hisoblanadi (qarang:
  /// [_maybeUpdateMahalla]) — har build'da EMAS.
  MahallaArea? _currentMahalla;

  /// Xodim HOZIR ish hududi (biriktirilgan mahallalar, aks holda tuman)
  /// ichidami — lokal jonli GPS ray-casting natijasi (`_boundaries.workZone`
  /// bo'yicha). `null` — hali hisoblanmagan; bunday holatda `/locations/me`
  /// dan kelgan server qiymati (`insideAssignedZone`) zaxira sifatida
  /// ishlatiladi (banner/marker shu bo'yicha yashil/qizil bo'ladi). Ilgarigi
  /// ofis DOIRASI (`insideGeofence`) o'rniga — endi ish hududi = mahalla
  /// poligonlari.
  bool? _insideZone;

  /// [_currentMahalla]/[_insideZone] oxirgi marta hisoblangan nuqta — juda
  /// kichik siljishlarda (GPS titrashi) qayta hisoblamaslik uchun.
  LatLng? _lastMahallaFix;

  @override
  void initState() {
    super.initState();
    // Doimiy lokatsiya kuzatuvini serverga yuborishni boshlaymiz (xodim ->
    // POST /locations, offline outbox bilan). Idempotent singleton — bir marta
    // boshlanadi va Map tabidan chiqilsa ham butun ilova davomida ishlaydi.
    unawaited(getIt<LocationTrackingService>().start());
    unawaited(_loadBoundaries());
    WidgetsBinding.instance.addObserver(this);
    // Admin hududni o'zgartirsa — ilovani qayta ochmasdan ham ko'rinsin.
    _zoneRefreshTimer = Timer.periodic(
      _zoneRefreshInterval,
      (_) => unawaited(_loadBoundaries()),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(_loadBoundaries());
  }

  /// `/locations/me` (biriktirilgan mahallalar) + chegaralar. Birinchi
  /// chaqiruvda geojson yuklanadi; keyingilarida (taymer/resume) faqat kodlar
  /// o'zgargan bo'lsa qayta chiziladi (geojson loader ichida keshlangan).
  Future<void> _loadBoundaries() async {
    final myZone = await _loader.loadMyZone();
    final codes = myZone.assignedMahallaCodes.toSet();
    final firstLoad = _boundaries.polygons.isEmpty;
    if (!firstLoad && _setEquals(codes, _assignedCodes)) return;
    final boundaries = await _loader.load(assignedCodes: codes);
    if (!mounted) return;
    _assignedCodes = codes;
    setState(() {
      _boundaries = boundaries;
      // Jonli GPS hisobi kelguncha bannerni server qiymati bilan boshlaymiz.
      _insideZone ??= myZone.insideAssignedZone;
    });
    // Xarita ochilishida BUTUN Mirzo Ulug'bek tumani ko'rinsin (bir marta).
    _fitToDistrictIfReady();
    // Chegaralar pozitsiyadan KEYIN kelishi mumkin — allaqachon ma'lum
    // joylashuv bo'lsa, mahalla + ish hududi holatini darhol hisoblaymiz.
    final snapshot = _mapSnapshot(context.read<MapCubit>().state);
    if (snapshot != null) {
      _lastMahallaFix = null; // majburiy qayta hisob
      _maybeUpdateMahalla(
        LatLng(snapshot.position.latitude, snapshot.position.longitude),
      );
    }
  }

  /// Kamerani BUTUN tuman (Mirzo Ulug'bek) chegara qutisiga moslaydi —
  /// xaritada to'liq tuman + biriktirilgan yashil ish hududi ko'rinadi.
  /// Birinchi kadrdan keyin bajariladi (`MapController` faqat map render
  /// bo'lgach tayyor). Tuman chegarasi bo'lmasa (offline) hech narsa qilmaydi.
  /// Muvaffaqiyatli bo'lsa `_centeredOnFirstFix = true` — jonli GPS kamerani
  /// o'ziga tortmasin.
  ///
  /// Faqat `FlutterMap` chizilgan bo'lsa ([_mapReady]); aks holda (ruxsat/xato
  /// ekrani ochiq) xarita paydo bo'lganda [_onMapReady] uni chaqiradi.
  /// Ilgari postFrame'da to'g'ridan-to'g'ri `fitCamera` chaqirilardi — xarita
  /// yo'q paytda u exception otib, kamera boshlang'ich nuqtada qolib ketardi.
  void _fitToDistrictIfReady() {
    final bounds = _boundaries.bounds;
    if (bounds == null || _districtFitted || !_mapReady) return;
    try {
      _mapController.fitCamera(
        CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(28)),
      );
      _districtFitted = true;
      _centeredOnFirstFix = true;
    } on Object {
      // Kamera hali tayyor emas — keyingi onMapReady'da qayta urinamiz.
    }
  }

  void _onMapReady() {
    _mapReady = true;
    _fitToDistrictIfReady();
  }

  static bool _setEquals(Set<String> a, Set<String> b) =>
      a.length == b.length && a.containsAll(b);

  /// Faqat pozitsiya oldingi hisobdan sezilarli (>~15 m) uzoqlashganda joriy
  /// mahallani qayta aniqlaydi — ray-casting har GPS o'lchovida emas, faqat
  /// haqiqiy harakatda ishlaydi (performance). O'zgarsa `setState` bilan chip
  /// va urg'u qayta chiziladi.
  static const double _mahallaRecomputeMeters = 15;

  void _maybeUpdateMahalla(LatLng point, {double? accuracy}) {
    if (accuracy != null) _lastAccuracy = accuracy;
    if (_boundaries.mahallas.isEmpty) return;
    final last = _lastMahallaFix;
    if (last != null &&
        const Distance().as(LengthUnit.Meter, last, point) <
            _mahallaRecomputeMeters) {
      return;
    }
    _lastMahallaFix = point;
    final match = mahallaAt(point, _boundaries.mahallas);
    // Ish hududi ichidami — biriktirilgan mahallalar (aks holda tuman) bo'yicha
    // lokal ray-casting. Ilgarigi ofis DOIRASIGA (insideGeofence) bog'liq emas.
    // workZone bo'sh bo'lsa (offline geojson) server qiymatini saqlab qolamiz.
    // Server bilan bir xil qoida (chegara tolerantligi) — aks holda
    // chegarada turgan xodim ilovada "tashqarida", admin'da "ichida" bo'lardi.
    final inside = _boundaries.workZone.isEmpty
        ? _insideZone
        : insideWorkZone(point, _boundaries, accuracyMeters: _lastAccuracy);
    if (!identical(match, _currentMahalla) || inside != _insideZone) {
      setState(() {
        _currentMahalla = match;
        _insideZone = inside;
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _zoneRefreshTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  void _recenterOn(Position position) {
    _mapController.move(
      LatLng(position.latitude, position.longitude),
      _mapController.camera.zoom,
    );
  }

  /// "Joriy joylashuvga markazlashtirish" FAB'i bosilganda: kuzatuv faol
  /// bo'lsa joriy pozitsiyaga kamerani ko'chiradi (state'da allaqachon bor —
  /// yangi so'rov shart emas); aks holda kuzatuvni (qayta) boshlaydi
  /// (`MapCubit.recenter()`).
  Future<void> _onRecenterPressed(MapCubit cubit) async {
    final current = cubit.state;
    if (current is MapTracking) {
      _recenterOn(current.position);
    } else if (current is MapStopped) {
      // To'xtatilgan bo'lsa ham oxirgi ma'lum pozitsiya allaqachon bor —
      // shunchaki kamerani shu nuqtaga suramiz, kuzatuvni qayta
      // boshlashning (`cubit.recenter()`) hojati yo'q.
      _recenterOn(current.position);
    } else {
      await cubit.recenter();
    }
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<MapCubit>();

    return BlocConsumer<MapCubit, MapState>(
      listener: (context, state) {
        // Har yangi pozitsiyada joriy mahallani (sezilarli siljish bo'lsa)
        // yangilaymiz — hisob build'da emas, shu yerda bir marta bajariladi.
        final snapshot = _mapSnapshot(state);
        if (snapshot != null) {
          _maybeUpdateMahalla(
            LatLng(snapshot.position.latitude, snapshot.position.longitude),
            accuracy: snapshot.position.accuracy,
          );
        }
        // Ruxsat/xato ekranida FlutterMap yo'q — keyingi chizilishda
        // onMapReady qayta keladi.
        if (state is MapPermissionDenied || state is MapError) {
          _mapReady = false;
        }
        // Tuman chegarasi mavjud bo'lsa — xarita BUTUN tumanga freym qilingan
        // (qarang: [_fitToDistrictIfReady]); jonli GPS kamerani o'ziga
        // tortmasin, aks holda to'liq tuman ko'rinmay qoladi. Faqat tuman
        // chegarasi yo'q (offline) bo'lganda birinchi fix'da o'z joyiga
        // markazlashadi.
        if (state is MapTracking &&
            !_centeredOnFirstFix &&
            _boundaries.bounds == null) {
          _centeredOnFirstFix = true;
          final position = state.position;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _recenterOn(position);
          });
        } else if (state is MapInitial || state is MapStopped) {
          // Kuzatuv hali boshlanmagan YOKI ataylab to'xtatilgan — ikkalasi
          // ham "keyingi sessiya yana bir marta avtomatik markazlashsin"
          // degani.
          _centeredOnFirstFix = false;
        }
      },
      builder: (context, state) {
        return switch (state) {
          MapPermissionDenied(:final permanentlyDenied) =>
            _PermissionDeniedView(
              permanentlyDenied: permanentlyDenied,
              onGrant: cubit.start,
            ),
          MapError(:final message) => _MapErrorView(
            message: message,
            onRetry: cubit.start,
          ),
          MapInitial() ||
          MapLoading() ||
          MapTracking() ||
          MapStopped() => _TrackingScaffold(
            state: state,
            mapController: _mapController,
            boundaries: _boundaries.polygons,
            currentMahalla: _currentMahalla,
            insideZone: _insideZone,
            onRecenter: () => _onRecenterPressed(cubit),
            onMapReady: _onMapReady,
          ),
        };
      },
    );
  }
}

/// `MapTracking` (jonli kuzatuv) va `MapStopped` (to'xtatilgan, lekin
/// "muzlatilgan" oxirgi ma'lumot) — ikkalasi ham marker/breadcrumb chizish
/// uchun bir xil (`position`/`trail`/`insideGeofence`) ma'lumotni beradi.
/// Farqi faqat "hozir FAOL kuzatilyaptimi" degan bitta bit — buni
/// chaqiruvchi (`_TrackingScaffold.build`) alohida `state is MapTracking`
/// orqali aniqlaydi (tugma yorlig'i/rangi uchun). Boshqa barcha holatlar
/// (`MapInitial`/`MapLoading`/xato/ruxsat) uchun `null` — ko'rsatadigan
/// pozitsiya yo'q.
({Position position, List<LatLng> trail, bool insideGeofence})? _mapSnapshot(
  MapState state,
) => switch (state) {
  MapTracking(:final position, :final trail, :final insideGeofence) => (
    position: position,
    trail: trail,
    insideGeofence: insideGeofence,
  ),
  MapStopped(:final position, :final trail, :final insideGeofence) => (
    position: position,
    trail: trail,
    insideGeofence: insideGeofence,
  ),
  _ => null,
};

/// Joriy mahalla uchun yengil urg'u poligonlari — faint brend to'ldirish +
/// biroz aniqroq chegara, shunda foydalanuvchi qaysi mahallada ekani darrov
/// ko'rinadi. MultiPolygon mahalla uchun har bir qismga bittadan.
List<Polygon> _highlightPolygons(MahallaArea mahalla) => [
  for (final part in mahalla.parts)
    Polygon<Object>(
      points: part.outer,
      holePointsList: part.holes.isEmpty ? null : part.holes,
      color: AppColors.primary.withValues(alpha: 0.14),
      borderColor: AppColors.primary.withValues(alpha: 0.6),
      borderStrokeWidth: 1.5,
    ),
];

/// "Yaxshi" holatlar (`MapInitial`/`MapLoading`/`MapTracking`/`MapStopped`)
/// uchun asosiy ko'rinish — to'liq ekranli xarita (geofence doirasi doim
/// ko'rinadi) + SafeArea ustidagi holat banneri va markazlashtirish FAB'i.
///
/// Kuzatuv DOIMIY (avtomatik boshlanadi, `app_router.dart`) — shu bois
/// xaritada "kuzatishni to'xtatish" tugmasi ATAYLAB yo'q. Foydalanuvchiga
/// faqat joriy joylashuvga qaytish (recenter FAB) kerak bo'ladi.
class _TrackingScaffold extends StatelessWidget {
  const _TrackingScaffold({
    required this.state,
    required this.mapController,
    required this.boundaries,
    required this.currentMahalla,
    required this.insideZone,
    required this.onRecenter,
    required this.onMapReady,
  });

  /// `FlutterMap` birinchi marta chizilib, `MapController` tayyor bo'lganda.
  final VoidCallback onMapReady;

  final MapState state;
  final MapController mapController;
  final List<Polygon> boundaries;

  /// Foydalanuvchi hozir ichida bo'lgan mahalla — yengil urg'u (faint fill) va
  /// yuqoridagi chip uchun. `null` bo'lsa tuman tashqarisida.
  final MahallaArea? currentMahalla;

  /// Xodim ish hududi (biriktirilgan mahallalar / tuman) ichidami — marker
  /// rangi va pastdagi banner shu bo'yicha. `null` — hali aniqlanmagan.
  final bool? insideZone;

  final VoidCallback onRecenter;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final snapshot = _mapSnapshot(state);

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: FlutterMap(
              mapController: mapController,
              options: MapOptions(
                // Yandex plitkalari EPSG:3395 da — poligon/markerlar mos
                // tushishi uchun xarita CRS ham shu bo'lishi shart.
                crs: const Epsg3395(),
                initialCenter: _workplaceCenter,
                initialZoom: _defaultZoom,
                maxZoom: 19,
                onMapReady: onMapReady,
                backgroundColor: isDark
                    ? AppColors.darkSurfaceAlt
                    : AppColors.surfaceAlt,
              ),
              children: [
                // Yandex Xaritalar (o'zbekcha yozuvlar) — hokimiyat xodimlari
                // tanish ko'rinish, mahalla darajasida batafsil.
                TileLayer(
                  urlTemplate: kYandexTileUrlTemplate,
                  userAgentPackageName: _tileUserAgentPackageName,
                  maxZoom: 19,
                ),
                // Joriy mahalla urg'usi — chegaralar OSTIDA yengil to'ldirish,
                // shunda ustidagi ingichka to'r ko'rinib turadi.
                if (currentMahalla != null)
                  PolygonLayer(polygons: _highlightPolygons(currentMahalla!)),
                // Ish hududi (biriktirilgan mahallalar yashil to'ldirilgan) +
                // mahalla to'ri + tuman chegarasi (backend /zones). Ilgarigi
                // 2 km ofis DOIRASI olib tashlandi — ish hududi endi xodimning
                // biriktirilgan mahalla poligonlari (biriktirilmagan bo'lsa
                // tuman). Bo'sh bo'lsa (offline/URL yo'q) chizilmaydi.
                if (boundaries.isNotEmpty) PolygonLayer(polygons: boundaries),
                // "Breadcrumb" izi — xodim yaqinda yurgan yo'l. Marker OSTIDA,
                // ingichka brend rangli chiziq (kamida 2 nuqta kerak).
                if (snapshot != null && snapshot.trail.length >= 2)
                  PolylineLayer(
                    polylines: [
                      Polyline<Object>(
                        points: snapshot.trail,
                        strokeWidth: 4,
                        color: AppColors.primary,
                        borderStrokeWidth: 1.5,
                        borderColor: AppColors.surface.withValues(alpha: 0.9),
                      ),
                    ],
                  ),
                if (snapshot != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(
                          snapshot.position.latitude,
                          snapshot.position.longitude,
                        ),
                        width: 44,
                        height: 44,
                        child: _PositionMarker(
                          // Marker rangi ish hududi (mahalla poligonlari)
                          // bo'yicha; lokal hisob hali kelmagan bo'lsa
                          // (null) doira-asosli qiymatga qaytadi.
                          insideGeofence: insideZone ?? snapshot.insideGeofence,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          Positioned.fill(
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Align(
                  alignment: Alignment.topCenter,
                  // Yuqorida FAQAT ixcham legenda chiplari — "ichida/tashqarida"
                  // holati endi bitta joyda (pastdagi `_WorkZoneInfoCard`)
                  // ko'rsatiladi, shu bois ilgarigi rangli `_GeofenceBanner`
                  // (aynan shu xabarni takrorlar edi) olib tashlandi.
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const _WorkZoneLegendChip(),
                      const SizedBox(height: 8),
                      _MahallaChip(mahalla: currentMahalla),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            left: 16,
            // FAB (bottom-right, standart Scaffold joylashuvi) bilan
            // qoplanmasligi uchun o'ng tomondan qo'shimcha joy —
            // taxminan FAB kengligi (56) + uning standart chekkasi (16).
            right: 88,
            bottom: 16,
            child: SafeArea(
              top: false,
              // Chapga tekislangan + kenglik cheklovi: keng ekranlarda karta
              // cho'zilib FAB ostiga kirib ketmasligi uchun (o'ng tomondagi
              // `right: 88` bilan birga banner FABni HECH QACHON qoplamaydi).
              child: Align(
                alignment: Alignment.bottomLeft,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 460),
                  child: _WorkZoneInfoCard(
                    // "Ish hududida / hududdan tashqarida" banneri endi
                    // biriktirilgan mahalla poligonlari (insideZone) bo'yicha —
                    // ilgarigi ofis doirasi (insideGeofence) o'rniga.
                    insideZone: insideZone,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        heroTag: 'mapRecenterFab',
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.surface,
        tooltip: context.l10n.mapRecenterTooltip,
        onPressed: onRecenter,
        child: const Icon(AppIcons.locationBold),
      ),
    );
  }
}

/// Xaritadagi joriy pozitsiya markeri — geofence holatiga qarab
/// yashil/qizil, oq halqa bilan (kichik xarita fonida ham ajralib turishi
/// uchun).
class _PositionMarker extends StatelessWidget {
  const _PositionMarker({required this.insideGeofence});

  final bool insideGeofence;

  @override
  Widget build(BuildContext context) {
    final color = insideGeofence ? AppColors.success : AppColors.danger;
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        border: Border.all(color: AppColors.surface, width: 3),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.45), blurRadius: 12),
        ],
      ),
      child: const Icon(
        AppIcons.locationBold,
        color: AppColors.surface,
        size: 18,
      ),
    );
  }
}

/// Joylashuv xizmati o'chirilgan yoki ruxsat rad etilgan — `_HomeErrorView`/
/// `FaceCheckinPage`ning `_MessageView`i bilan bir xil naqsh (icon + sarlavha
/// + xabar + CTA), hech qachon tupikka olib kelmaydi.
///
/// [permanentlyDenied] `true` bo'lsa (OS endi qayta so'rash oynasini
/// ko'rsatmaydi) CTA "Sozlamalarni ochish"ga aylanadi va `openAppSettings()`
/// chaqiradi — `FaceEnrollPage`/`FaceCheckinPage`dagi
/// `FacePermissionDenied` bilan BIR XIL naqsh.
class _PermissionDeniedView extends StatelessWidget {
  const _PermissionDeniedView({
    required this.permanentlyDenied,
    required this.onGrant,
  });

  final bool permanentlyDenied;
  final VoidCallback onGrant;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: EmptyState(
            icon: AppIcons.location,
            title: l10n.mapPermissionTitle,
            message: l10n.mapPermissionMessage,
            action: AppButton(
              label: permanentlyDenied
                  ? l10n.faceOpenSettings
                  : l10n.mapGrantPermission,
              expand: false,
              onPressed: () {
                if (permanentlyDenied) {
                  unawaited(openAppSettings());
                } else {
                  onGrant();
                }
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Ruxsat tekshiruvi yoki joylashuv oqimi kutilmagan xato bilan yakunlandi —
/// `_HomeErrorView` bilan bir xil naqsh: xabar + "Qayta urinish".
class _MapErrorView extends StatelessWidget {
  const _MapErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkCanvas : AppColors.canvas,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: EmptyState(
            icon: AppIcons.close,
            title: l10n.mapErrorTitle,
            message: message,
            action: AppButton(
              label: l10n.retry,
              expand: false,
              onPressed: onRetry,
            ),
          ),
        ),
      ),
    );
  }
}

/// Yashil doiraning aynan "Ish hududi" ekanligini bildiruvchi kichik yorliq
/// — xaritadagi banner ostida ko'rsatiladi. Doirani o'chirmasdan, uning
/// nimaligini og'zaki tushuntiradi (foydalanuvchi ilgari faqat rangli
/// doirani ko'rar edi, nimaligini taxmin qilishi kerak edi).
class _WorkZoneLegendChip extends StatelessWidget {
  const _WorkZoneLegendChip();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark ? AppColors.darkLine : AppColors.line,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primary,
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.4),
                width: 3,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              l10n.mapWorkZoneLegend,
              style: AppTextStyles.caption.copyWith(
                color: isDark ? AppColors.darkInk : AppColors.ink,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// Joriy mahalla chipi — "📍 mahalla nomi", yoki tuman tashqarisida bo'lsa
/// "Tuman tashqarisida". Nom lokal ray-casting orqali aniqlanadi (qarang:
/// `mahallaAt`) — tarmoqqa murojaat qilmaydi. Mos l10n kaliti yo'q, shuning
/// uchun matn oddiy o'zbekcha.
class _MahallaChip extends StatelessWidget {
  const _MahallaChip({required this.mahalla});

  final MahallaArea? mahalla;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inside = mahalla != null && mahalla!.name.isNotEmpty;
    final label = inside ? mahalla!.name : 'Tuman tashqarisida';
    final accent = inside ? AppColors.primary : AppColors.inkMuted;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: isDark ? AppColors.darkLine : AppColors.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(IconsaxPlusBold.location, size: 14, color: accent),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: AppTextStyles.caption.copyWith(
                color: isDark ? AppColors.darkInk : AppColors.ink,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// Vaqtga-mos (time-aware) ish hududi holati — ish vaqti + ish hududi
/// ichida/tashqarisida bo'lishiga qarab uch xil xabar:
/// - ish vaqti + ichkarida → ijobiy tasdiqlash;
/// - ish vaqti + tashqarida → ogohlantirish;
/// - ish vaqti EMAS → neytral (joylashuv e'tiborga olinmaydi).
///
/// [insideZone] `null` bo'lishi mumkin (kuzatuv hali boshlanmagan/
/// pozitsiya kutilmoqda) — bu holatda, ish vaqti bo'lsa ham, aniq
/// tasdiqlash/ogohlantirish emas, joylashuv "aniqlanmoqda" (neytral)
/// ko'rsatiladi.
({Color color, IconData icon, String message}) _presenceInfo(
  AppLocalizations l10n, {
  required bool? insideZone,
}) {
  if (!_isWithinWorkHours(DateTime.now())) {
    return (
      color: AppColors.inkMuted,
      icon: AppIcons.clock,
      message: l10n.mapOffWorkHoursMessage,
    );
  }
  if (insideZone == null) {
    return (
      color: AppColors.inkMuted,
      icon: AppIcons.location,
      message: l10n.mapLocating,
    );
  }
  if (insideZone) {
    return (
      color: AppColors.success,
      icon: AppIcons.tick,
      message: l10n.mapWorkHourInsideMessage,
    );
  }
  return (
    color: AppColors.danger,
    icon: AppIcons.close,
    message: l10n.mapWorkHourOutsideMessage,
  );
}

/// Xarita ekranidagi ixcham "Ish hududi qoidasi" kartasi — pastda, doim
/// ko'rinadigan (a) vaqtga-mos hozirgi holat qatori va (b) bosilganda
/// kengayadigan qoida matni ("Ish vaqtida ish hududida bo'ling...").
/// Standart holatda YIG'ILGAN (faqat bitta qator) — "wall of text" emas,
/// foydalanuvchi qoidani o'qishni xohlasa o'zi kengaytiradi.
class _WorkZoneInfoCard extends StatefulWidget {
  const _WorkZoneInfoCard({required this.insideZone});

  /// Xodim ish hududi (biriktirilgan mahallalar / tuman) ichidami — banner
  /// rangi/matni shu bo'yicha. `null` — hali aniqlanmagan ("aniqlanmoqda").
  final bool? insideZone;

  @override
  State<_WorkZoneInfoCard> createState() => _WorkZoneInfoCardState();
}

class _WorkZoneInfoCardState extends State<_WorkZoneInfoCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedColor = isDark ? AppColors.darkInkMuted : AppColors.inkMuted;
    final ink = isDark ? AppColors.darkInk : AppColors.ink;
    final info = _presenceInfo(l10n, insideZone: widget.insideZone);

    return AppCard(
      shadow: true,
      onTap: () => setState(() => _expanded = !_expanded),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(info.icon, size: 18, color: info.color),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  info.message,
                  style: AppTextStyles.bodyStrong.copyWith(color: info.color),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 6),
              AnimatedRotation(
                turns: _expanded ? 0.5 : 0,
                duration: const Duration(milliseconds: 200),
                child: Icon(
                  IconsaxPlusLinear.arrow_down_1,
                  size: 16,
                  color: mutedColor,
                ),
              ),
            ],
          ),
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 200),
            crossFadeState: _expanded
                ? CrossFadeState.showFirst
                : CrossFadeState.showSecond,
            firstChild: Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Divider(
                    height: 1,
                    color: isDark ? AppColors.darkLine : AppColors.line,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    l10n.mapWorkZoneRuleTitle,
                    style: AppTextStyles.label.copyWith(color: ink),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.mapWorkZoneRuleText,
                    style: AppTextStyles.caption.copyWith(color: mutedColor),
                  ),
                ],
              ),
            ),
            secondChild: const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );
  }
}
