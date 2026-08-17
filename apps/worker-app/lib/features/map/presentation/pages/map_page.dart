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
import 'package:worker_app/features/map/data/zone_boundary_loader.dart';
import 'package:worker_app/features/map/presentation/bloc/map_cubit.dart';
import 'package:worker_app/features/tracking/location_tracking_service.dart';
import 'package:worker_app/injection.dart';

/// OpenStreetMap tayl serveri — OSM foydalanish siyosati identifikatorli
/// `User-Agent` talab qiladi (qarang: `TileLayer.userAgentPackageName`).
const _osmTileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const _osmUserAgentPackageName = 'uz.gov.hokimiyat.worker_app';

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

class _MapPageState extends State<MapPage> {
  final _mapController = MapController();

  /// Joriy kuzatuv sessiyasida kamera birinchi qabul qilingan pozitsiyaga
  /// ALLAQACHON markazlashtirilganmi. Faqat BIR MARTA avtomatik
  /// markazlashtiradi — aks holda foydalanuvchi xaritani qo'lda surganda
  /// har yangi pozitsiyada kamera "sudralib" tirishqoqlik qilardi.
  /// `MapInitial`ga qaytilganda (kuzatuv to'xtatilganda) qayta `false`ga
  /// tushadi, shunda keyingi sessiya yana bir marta markazlashadi.
  bool _centeredOnFirstFix = false;

  /// Tuman + mahalla chegaralari (backend `/zones` dan) — bir marta yuklanadi.
  ZoneBoundaries _boundaries = ZoneBoundaries.empty;

  /// Foydalanuvchi HOZIR ichida bo'lgan mahalla (lokal ray-casting natijasi) —
  /// `null` bo'lsa tuman tashqarisida (yoki chegaralar hali yuklanmagan).
  /// Faqat pozitsiya sezilarli o'zgarganda qayta hisoblanadi (qarang:
  /// [_maybeUpdateMahalla]) — har build'da EMAS.
  MahallaArea? _currentMahalla;

  /// [_currentMahalla] oxirgi marta hisoblangan nuqta — juda kichik
  /// siljishlarda (GPS titrashi) qayta hisoblamaslik uchun.
  LatLng? _lastMahallaFix;

  @override
  void initState() {
    super.initState();
    // Doimiy lokatsiya kuzatuvini serverga yuborishni boshlaymiz (xodim ->
    // POST /locations, offline outbox bilan). Idempotent singleton — bir marta
    // boshlanadi va Map tabidan chiqilsa ham butun ilova davomida ishlaydi.
    unawaited(getIt<LocationTrackingService>().start());
    unawaited(_loadBoundaries());
  }

  Future<void> _loadBoundaries() async {
    final boundaries = await ZoneBoundaryLoader(getIt<DioClient>().dio).load();
    if (!mounted) return;
    setState(() => _boundaries = boundaries);
    // Chegaralar pozitsiyadan KEYIN kelishi mumkin — allaqachon ma'lum
    // joylashuv bo'lsa, mahallani darhol hisoblaymiz (bo'sh chip ko'rinmasin).
    final snapshot = _mapSnapshot(context.read<MapCubit>().state);
    if (snapshot != null) {
      _lastMahallaFix = null; // majburiy qayta hisob
      _maybeUpdateMahalla(
        LatLng(snapshot.position.latitude, snapshot.position.longitude),
      );
    }
  }

  /// Faqat pozitsiya oldingi hisobdan sezilarli (>~15 m) uzoqlashganda joriy
  /// mahallani qayta aniqlaydi — ray-casting har GPS o'lchovida emas, faqat
  /// haqiqiy harakatda ishlaydi (performance). O'zgarsa `setState` bilan chip
  /// va urg'u qayta chiziladi.
  static const double _mahallaRecomputeMeters = 15;

  void _maybeUpdateMahalla(LatLng point) {
    if (_boundaries.mahallas.isEmpty) return;
    final last = _lastMahallaFix;
    if (last != null &&
        const Distance().as(LengthUnit.Meter, last, point) <
            _mahallaRecomputeMeters) {
      return;
    }
    _lastMahallaFix = point;
    final match = mahallaAt(point, _boundaries.mahallas);
    if (!identical(match, _currentMahalla)) {
      setState(() => _currentMahalla = match);
    }
  }

  @override
  void dispose() {
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
          );
        }
        if (state is MapTracking && !_centeredOnFirstFix) {
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
            onRecenter: () => _onRecenterPressed(cubit),
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
    required this.onRecenter,
  });

  final MapState state;
  final MapController mapController;
  final List<Polygon> boundaries;

  /// Foydalanuvchi hozir ichida bo'lgan mahalla — yengil urg'u (faint fill) va
  /// yuqoridagi chip uchun. `null` bo'lsa tuman tashqarisida.
  final MahallaArea? currentMahalla;

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
                initialCenter: _workplaceCenter,
                initialZoom: _defaultZoom,
                backgroundColor: isDark
                    ? AppColors.darkSurfaceAlt
                    : AppColors.surfaceAlt,
              ),
              children: [
                TileLayer(
                  urlTemplate: _osmTileUrlTemplate,
                  userAgentPackageName: _osmUserAgentPackageName,
                ),
                // Joriy mahalla urg'usi — chegaralar OSTIDA yengil to'ldirish,
                // shunda ustidagi ingichka to'r ko'rinib turadi.
                if (currentMahalla != null)
                  PolygonLayer(polygons: _highlightPolygons(currentMahalla!)),
                // Tuman + mahalla chegaralari (backend /zones) — hudud
                // vizualizatsiyasi. Bo'sh bo'lsa (offline/URL yo'q) chizilmaydi.
                if (boundaries.isNotEmpty) PolygonLayer(polygons: boundaries),
                CircleLayer(
                  circles: [
                    CircleMarker(
                      point: _workplaceCenter,
                      radius: kGeofenceRadius,
                      useRadiusInMeter: true,
                      color: AppColors.primary.withValues(alpha: 0.14),
                      borderStrokeWidth: 2,
                      borderColor: AppColors.primary,
                    ),
                  ],
                ),
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
                          insideGeofence: snapshot.insideGeofence,
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
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _GeofenceBanner(state: state),
                      const SizedBox(height: 10),
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
              child: _WorkZoneInfoCard(
                insideGeofence: snapshot?.insideGeofence,
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

/// Xarita tepasidagi holat banneri — `FaceCheckinPage`ning
/// `_GeofenceBanner`i bilan bir xil g'oya (yashil ichkarida/qizil
/// tashqarida), qo'shimcha ravishda kuzatuv hali boshlanmagan/aniqlanayotgan
/// holatlar uchun neytral variant bilan.
class _GeofenceBanner extends StatelessWidget {
  const _GeofenceBanner({required this.state});

  final MapState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (Color color, String text) = switch (state) {
      MapTracking(:final insideGeofence) =>
        insideGeofence
            ? (AppColors.success, l10n.insideGeofence)
            : (AppColors.danger, l10n.outsideGeofence),
      MapLoading() => (AppColors.inkMuted, l10n.mapLocating),
      MapInitial() ||
      MapStopped() ||
      MapPermissionDenied() ||
      MapError() => (AppColors.inkMuted, l10n.mapNotTracking),
    };

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOutCubic,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(AppRadii.sm),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(AppIcons.locationBold, size: 15, color: AppColors.surface),
          const SizedBox(width: 6),
          // `Flexible` + ellipsis: uzunroq tarjima qilingan xabar (masalan
          // ruscha "Вы находитесь за пределами рабочей зоны") tor
          // ekranlarda banner Row'ini "toshib ketishi"ning oldini oladi.
          Flexible(
            child: Text(
              text,
              style: AppTextStyles.label.copyWith(color: AppColors.surface),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
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
/// [insideGeofence] `null` bo'lishi mumkin (kuzatuv hali boshlanmagan/
/// pozitsiya kutilmoqda) — bu holatda, ish vaqti bo'lsa ham, aniq
/// tasdiqlash/ogohlantirish emas, joylashuv "aniqlanmoqda" (neytral)
/// ko'rsatiladi.
({Color color, IconData icon, String message}) _presenceInfo(
  AppLocalizations l10n, {
  required bool? insideGeofence,
}) {
  if (!_isWithinWorkHours(DateTime.now())) {
    return (
      color: AppColors.inkMuted,
      icon: AppIcons.clock,
      message: l10n.mapOffWorkHoursMessage,
    );
  }
  if (insideGeofence == null) {
    return (
      color: AppColors.inkMuted,
      icon: AppIcons.location,
      message: l10n.mapLocating,
    );
  }
  if (insideGeofence) {
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
  const _WorkZoneInfoCard({required this.insideGeofence});

  final bool? insideGeofence;

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
    final info = _presenceInfo(l10n, insideGeofence: widget.insideGeofence);

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
