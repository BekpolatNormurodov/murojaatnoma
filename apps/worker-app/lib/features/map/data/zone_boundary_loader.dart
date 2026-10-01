import 'dart:math' as math;

import 'package:app_ui/app_ui.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Backend'dagi `/zones/geojson` dan tuman + mahalla chegaralarini yuklaydi.
///
/// Ikki xil natija qaytaradi (bitta yuklashda):
///  * [ZoneBoundaries.polygons] — `flutter_map` uchun chizma poligonlari
///    (tuman qalin, mahallalar ingichka);
///  * [ZoneBoundaries.mahallas] — har bir mahallaning NOMI + halqa
///    koordinatalari ([MahallaArea]) — bu tarmoqqa murojaat qilmasdan,
///    lokal "nuqta poligon ichidami" (ray-casting) hisobi uchun ishlatiladi
///    (qarang: [mahallaAt]).
///
/// GeoJSON koordinatalari `[lng, lat]` — `LatLng(lat, lng)` ga o'giriladi.
/// Xato (offline/URL yo'q) bo'lsa bo'sh natija qaytaradi (xarita baribir
/// ishlaydi).
class ZoneBoundaryLoader {
  ZoneBoundaryLoader(this._dio);

  final Dio _dio;

  // Tuman chegarasi — brend yashil (app_ui token: web-admin bilan 1:1).
  static const Color _districtColor = AppColors.primaryDark;

  // Tuman — qalin ajralib turadigan tashqi chegara + yengil to'ldirish.
  static const double _districtBorderWidth = 3;
  static const double _districtFillAlpha = 0.05;

  // Mahallalar — ingichka, "sekin" (past kontrast) to'r; to'ldirishsiz, shunda
  // tuman chegarasi va joriy mahalla urg'usi ustidan ustunlik qiladi.
  static const double _mahallaBorderWidth = 0.8;
  // Muted slate token (app_ui) + ~55% alpha (avvalgi 0x8C bilan bir xil).
  static final Color _mahallaBorderColor =
      AppColors.inkMuted.withValues(alpha: 0.55);

  // Biriktirilgan mahallalar ("Ish hududi") — brend yashil to'ldirish +
  // aniq chegara. Bu xodimning HAQIQIY ish hududi (ilgarigi 2 km ofis
  // doirasi o'rniga) — shu bois grid/tuman ustidan ajralib turadi.
  static const Color _workZoneColor = AppColors.primary;
  static const double _workZoneBorderWidth = 2.2;
  static const double _workZoneFillAlpha = 0.16;

  /// [assignedCodes] — xodim biriktirilgan mahalla kodlari
  /// (`properties.id`). Bo'sh bo'lsa (biriktirilmagan / offline) faqat tuman
  /// chegarasi ish hududi bo'lib qoladi (fallback).
  // GeoJSON is static for the whole session — fetched once per loader, so a
  // zone re-assignment only re-filters/re-colours, never re-downloads.
  List<_ZoneFeature>? _mahallaCache;
  List<_ZoneFeature>? _districtCache;

  Future<ZoneBoundaries> load({Set<String> assignedCodes = const {}}) async {
    final mahallaFeatures = _mahallaCache ??= await _load('mahalla');
    final districtFeatures = _districtCache ??= await _load('district');
    // Don't cache an empty (failed/offline) fetch — retry next time.
    if (mahallaFeatures.isEmpty) _mahallaCache = null;
    if (districtFeatures.isEmpty) _districtCache = null;

    // Biriktirilgan mahalla feature'lari (kodi bo'yicha) — "Ish hududi"
    // sifatida yashil chiziladi va lokal "ichidami" hisobiga ishlatiladi.
    final assignedFeatures = assignedCodes.isEmpty
        ? const <_ZoneFeature>[]
        : <_ZoneFeature>[
            for (final f in mahallaFeatures)
              if (assignedCodes.contains(f.code)) f,
          ];

    // Chizish tartibi: avval mahallalar to'ri (ingichka), so'ng biriktirilgan
    // mahallalar (yashil to'ldirish), oxirida tuman (qalin chegara) — shunda
    // ish hududi yashilligi to'r ustidan ko'rinadi, tuman esa hammasi ustidan.
    final polygons = <Polygon>[
      for (final f in mahallaFeatures)
        ..._polygonsOf(
          f,
          borderColor: _mahallaBorderColor,
          borderWidth: _mahallaBorderWidth,
          fillAlpha: 0,
        ),
      for (final f in assignedFeatures)
        ..._polygonsOf(
          f,
          borderColor: _workZoneColor,
          borderWidth: _workZoneBorderWidth,
          fillAlpha: _workZoneFillAlpha,
        ),
      for (final f in districtFeatures)
        ..._polygonsOf(
          f,
          borderColor: _districtColor,
          borderWidth: _districtBorderWidth,
          fillAlpha: _districtFillAlpha,
        ),
    ];

    final mahallas = <MahallaArea>[
      for (final f in mahallaFeatures)
        MahallaArea(name: f.name, code: f.code, parts: f.parts),
    ];

    // Xaritani ochilishda BUTUN tuman ko'rinishi uchun chegara qutisi
    // (bounding box). Tuman feature'idan (Mirzo Ulug'bek to'liq) hisoblanadi;
    // tuman bo'lmasa (offline) mahallalar bo'yicha zaxira. Bo'sh bo'lsa null —
    // u holda kamera boshlang'ich markazda qoladi.
    final boundsSource =
        districtFeatures.isNotEmpty ? districtFeatures : mahallaFeatures;
    final bounds = _boundsOf(boundsSource);

    // Ish hududi hisobi uchun hududlar: biriktirilgan mahallalar bo'lsa —
    // o'shalar; aks holda (biriktirilmagan) — tuman (fallback). Lokal
    // ray-casting orqali "xodim ish hududi ichidami" tekshiriladi.
    final workZone = assignedFeatures.isNotEmpty
        ? <MahallaArea>[
            for (final f in assignedFeatures)
              MahallaArea(name: f.name, code: f.code, parts: f.parts),
          ]
        : <MahallaArea>[
            for (final f in districtFeatures)
              MahallaArea(name: f.name, code: f.code, parts: f.parts),
          ];

    return ZoneBoundaries(
      polygons: polygons,
      mahallas: mahallas,
      workZone: workZone,
      workZoneIsAssigned: assignedFeatures.isNotEmpty,
      bounds: bounds,
    );
  }

  /// [features] barcha poligon nuqtalarini qamrab oladigan chegara qutisi
  /// (kamera "fitCamera" uchun). Nuqta bo'lmasa `null`.
  LatLngBounds? _boundsOf(List<_ZoneFeature> features) {
    final points = <LatLng>[
      for (final f in features)
        for (final part in f.parts) ...part.outer,
    ];
    if (points.isEmpty) return null;
    return LatLngBounds.fromPoints(points);
  }

  /// `/locations/me` — joriy xodimning biriktirilgan mahalla kodlari va
  /// (server hisoblagan) ish hududi ichida/tashqarisida holati. Xato/offline
  /// bo'lsa bo'sh natija (biriktirilmagan kabi — tuman fallback ishlaydi).
  Future<MyZone> loadMyZone() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/locations/me');
      final data = res.data ?? const <String, dynamic>{};
      final codes = <String>[
        for (final c
            in (data['assignedMahallaCodes'] as List<dynamic>? ?? const []))
          if (c != null) c.toString(),
      ];
      final inside = data['insideAssignedZone'];
      return MyZone(
        assignedMahallaCodes: codes,
        insideAssignedZone: inside is bool ? inside : null,
      );
    } on Object {
      return MyZone.empty;
    }
  }

  Future<List<_ZoneFeature>> _load(String kind) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/zones/geojson',
        queryParameters: <String, dynamic>{'kind': kind},
      );
      final features = (res.data?['features'] as List<dynamic>?) ?? const [];
      final out = <_ZoneFeature>[];
      for (final f in features) {
        final map = f as Map<String, dynamic>;
        final geometry = map['geometry'] as Map<String, dynamic>?;
        if (geometry == null) continue;
        final type = geometry['type'] as String?;
        final coordinates = geometry['coordinates'] as List<dynamic>?;
        if (coordinates == null) continue;

        final parts = <MahallaPolygon>[];
        if (type == 'Polygon') {
          _addPart(parts, coordinates);
        } else if (type == 'MultiPolygon') {
          for (final poly in coordinates) {
            _addPart(parts, poly as List<dynamic>);
          }
        }
        if (parts.isEmpty) continue;

        final props = map['properties'] as Map<String, dynamic>?;
        out.add(
          _ZoneFeature(
            name: _nameOf(props),
            code: _codeOf(props),
            parts: parts,
          ),
        );
      }
      return out;
    } on Object {
      return const [];
    }
  }

  void _addPart(List<MahallaPolygon> parts, List<dynamic> rings) {
    if (rings.isEmpty) return;
    final outer = _ring(rings.first as List<dynamic>);
    if (outer.length < 3) return;
    final holes = <List<LatLng>>[];
    for (var i = 1; i < rings.length; i++) {
      holes.add(_ring(rings[i] as List<dynamic>));
    }
    parts.add(MahallaPolygon(outer: outer, holes: holes));
  }

  Iterable<Polygon> _polygonsOf(
    _ZoneFeature feature, {
    required Color borderColor,
    required double borderWidth,
    required double fillAlpha,
  }) sync* {
    for (final part in feature.parts) {
      yield Polygon<Object>(
        points: part.outer,
        holePointsList: part.holes.isEmpty ? null : part.holes,
        borderColor: borderColor,
        borderStrokeWidth: borderWidth,
        color: fillAlpha > 0 ? borderColor.withValues(alpha: fillAlpha) : null,
      );
    }
  }

  /// Mahalla kodi — `properties.id` (masalan "1090080"). Biriktirilgan
  /// mahallalarni (`assignedMahallaCodes`) tanlash uchun ishlatiladi. Tuman
  /// feature'ida bo'lmasligi mumkin — u holda bo'sh (kod bo'yicha
  /// solishtirilmaydi ham).
  String _codeOf(Map<String, dynamic>? props) {
    if (props == null) return '';
    final value = props['id'];
    if (value == null) return '';
    return value.toString().trim();
  }

  /// Mahalla nomi — Uzbek (lotin) birinchi, so'ng kirill/rus, oxirida kod.
  String _nameOf(Map<String, dynamic>? props) {
    if (props == null) return '';
    const keys = ['name_uz_lt', 'name_uz_cyr', 'name_ru', 'code'];
    for (final key in keys) {
      final value = props[key];
      if (value is String && value.trim().isNotEmpty) return value.trim();
    }
    return '';
  }

  List<LatLng> _ring(List<dynamic> ring) {
    return <LatLng>[
      for (final p in ring)
        LatLng(
          ((p as List<dynamic>)[1] as num).toDouble(),
          (p[0] as num).toDouble(),
        ),
    ];
  }
}

/// Bitta yuklashda qaytadigan natija — chizma poligonlari + mahalla hududlari.
class ZoneBoundaries {
  const ZoneBoundaries({
    required this.polygons,
    required this.mahallas,
    this.workZone = const [],
    this.workZoneIsAssigned = false,
    this.bounds,
  });

  /// [workZone] — biriktirilgan mahallalarmi (true) yoki tuman fallback'i
  /// (false). GPS chegarasi tolerantligi faqat biriktirilgan mahallalarga
  /// qo'llanadi (server bilan bir xil qoida).
  final bool workZoneIsAssigned;

  /// Xaritada chiziladigan tuman + mahalla poligonlari (tartibda).
  final List<Polygon> polygons;

  /// Lokal "qaysi mahalla" hisobi uchun BARCHA mahalla hududlari (nom +
  /// halqalar) — joriy mahalla chipi uchun.
  final List<MahallaArea> mahallas;

  /// "Ish hududi" hududlari — biriktirilgan mahallalar (bo'lsa), aks holda
  /// tuman (fallback). Lokal "xodim ish hududi ichidami" hisobiga ishlatiladi
  /// (banner/marker shu bo'yicha yashil/qizil bo'ladi).
  final List<MahallaArea> workZone;

  /// Butun tuman (Mirzo Ulug'bek) chegara qutisi — xarita ochilishida kamera
  /// shu qutiga moslanadi ("fitCamera"), shunda TO'LIQ tuman ko'rinadi.
  /// `null` bo'lsa (offline/URL yo'q) kamera boshlang'ich markazda qoladi.
  final LatLngBounds? bounds;

  static const ZoneBoundaries empty =
      ZoneBoundaries(polygons: [], mahallas: []);
}

/// `/locations/me` javobining ish-hududiga oid qismi — xodim biriktirilgan
/// mahalla kodlari + (server hisoblagan) ish hududi ichida/tashqarisida
/// holati. Bo'sh kodlar = butun tuman (biriktirilmagan).
class MyZone {
  const MyZone({
    required this.assignedMahallaCodes,
    required this.insideAssignedZone,
  });

  /// Biriktirilgan mahalla kodlari (`properties.id` bilan mos). Bo'sh bo'lsa —
  /// biriktirilmagan (butun tuman ish hududi).
  final List<String> assignedMahallaCodes;

  /// Server tomonidan hisoblangan "ish hududi ichidami" (oxirgi yuborilgan
  /// joylashuv bo'yicha). `null` — hali ma'lum emas. Lokal jonli GPS hisobi
  /// (`ZoneBoundaries.workZone`) mavjud bo'lguncha boshlang'ich/zaxira qiymat.
  final bool? insideAssignedZone;

  static const MyZone empty =
      MyZone(assignedMahallaCodes: [], insideAssignedZone: null);
}

/// Bitta mahalla hududi — ko'rsatiladigan [name] + bir yoki bir nechta poligon
/// [parts] (MultiPolygon mahallada bittadan ko'p). Nuqta shu hudud ichidami
/// ([contains]) tekshiruvi lokal ray-casting orqali bajariladi — hech qanday
/// tarmoq murojaati yo'q.
class MahallaArea {
  const MahallaArea({
    required this.name,
    required this.parts,
    this.code = '',
  });

  final String name;

  /// Mahalla kodi (`properties.id`) — biriktirilgan mahallalarni tanlash
  /// uchun. Tuman hududida bo'sh.
  final String code;
  final List<MahallaPolygon> parts;

  /// [point] shu mahallaning HAR QANDAY poligoni ichida bo'lsa `true`.
  /// [point] dan shu hududning ENG YAQIN chegara qirrasigacha masofa (m).
  /// Mahalla miqyosida (bir necha km) ekvirektangulyar proyeksiya yetarli.
  double distanceToEdgeMeters(LatLng point) {
    var best = double.infinity;
    for (final part in parts) {
      for (final ring in [part.outer, ...part.holes]) {
        final d = _distanceToRingMeters(point, ring);
        if (d < best) best = d;
      }
    }
    return best;
  }

  bool contains(LatLng point) {
    for (final part in parts) {
      if (part.contains(point)) return true;
    }
    return false;
  }
}

/// Bitta poligon — tashqi halqa [outer] + (ixtiyoriy) ichki "teshik"lar
/// [holes]. Nuqta poligon ichida bo'lishi uchun: tashqi halqa ichida VA
/// hech qaysi teshik ichida bo'lmasligi kerak.
class MahallaPolygon {
  const MahallaPolygon({required this.outer, required this.holes});

  final List<LatLng> outer;
  final List<List<LatLng>> holes;

  bool contains(LatLng point) {
    if (!_rayCastInside(point, outer)) return false;
    for (final hole in holes) {
      if (_rayCastInside(point, hole)) return false;
    }
    return true;
  }
}

/// Berilgan [point]ni O'Z ICHIGA olgan BIRINCHI mahallani qaytaradi — hech
/// biri bo'lmasa `null` (tuman tashqarisida yoki chegaralar yuklanmagan).
///
/// Sof lokal hisob (ray-casting) — har bir GPS o'lchovida tarmoqqa murojaat
/// qilmaslik uchun (`/zones/locate` endpointi bor, lekin u har fix uchun
/// chaqirilmaydi).
MahallaArea? mahallaAt(LatLng point, List<MahallaArea> areas) {
  for (final area in areas) {
    if (area.contains(point)) return area;
  }
  return null;
}

/// "Ray-casting" (nurni tashlash) algoritmi — [point] [ring] (yopiq halqa)
/// ichidami. Uzunlik = x (lng), kenglik = y (lat). Nuqtadan o'ngga tashlangan
/// nur poligon qirralarini toq marta kessa — ichkarida.
bool _rayCastInside(LatLng point, List<LatLng> ring) {
  final x = point.longitude;
  final y = point.latitude;
  var inside = false;
  final n = ring.length;
  for (var i = 0, j = n - 1; i < n; j = i++) {
    final xi = ring[i].longitude;
    final yi = ring[i].latitude;
    final xj = ring[j].longitude;
    final yj = ring[j].latitude;
    final intersects = (yi > y) != (yj > y) &&
        x < (xj - xi) * (y - yi) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/// Yuklashning ichki oraliq modeli — nom + poligon qismlari. Tuman uchun ham,
/// mahalla uchun ham bir xil; faqat mahallalar tashqariga [MahallaArea]
/// sifatida chiqariladi.
class _ZoneFeature {
  const _ZoneFeature({
    required this.name,
    required this.code,
    required this.parts,
  });

  final String name;
  final String code;
  final List<MahallaPolygon> parts;
}

/// Nuqtadan halqa qirralarigacha eng qisqa masofa (m) — server
/// (`distanceToGeometryEdgeM`) bilan bir xil formula.
double _distanceToRingMeters(LatLng p, List<LatLng> ring) {
  const mPerDegLat = 111320.0;
  final mPerDegLng = 111320.0 * math.cos(p.latitude * math.pi / 180);
  var best = double.infinity;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    final ax = (ring[j].longitude - p.longitude) * mPerDegLng;
    final ay = (ring[j].latitude - p.latitude) * mPerDegLat;
    final bx = (ring[i].longitude - p.longitude) * mPerDegLng;
    final by = (ring[i].latitude - p.latitude) * mPerDegLat;
    final dx = bx - ax;
    final dy = by - ay;
    final len2 = dx * dx + dy * dy;
    final t = len2 == 0 ? 0.0 : (-(ax * dx + ay * dy) / len2).clamp(0.0, 1.0);
    final cx = ax + t * dx;
    final cy = ay + t * dy;
    final d = math.sqrt(cx * cx + cy * cy);
    if (d < best) best = d;
  }
  return best;
}

/// Server bilan BIR XIL ish hududi qoidasi: qat'iy "ichida" YOKI (faqat
/// biriktirilgan mahallalar uchun) chegaradan `35 m + min(aniqlik, 75 m)`
/// ichida — GPS titrashi chegarada turgan xodimni "tashqarida" qilmasin
/// (qarang: backend `locations.service.ts`, ZONE_TOLERANCE_*).
bool insideWorkZone(
  LatLng point,
  ZoneBoundaries boundaries, {
  double accuracyMeters = 0,
}) {
  if (mahallaAt(point, boundaries.workZone) != null) return true;
  if (!boundaries.workZoneIsAssigned) return false;
  final tolerance = 35 + math.min(math.max(accuracyMeters, 0), 75);
  for (final area in boundaries.workZone) {
    if (area.distanceToEdgeMeters(point) <= tolerance) return true;
  }
  return false;
}
