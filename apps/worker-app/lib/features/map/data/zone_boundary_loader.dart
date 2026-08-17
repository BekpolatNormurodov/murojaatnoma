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

  static const Color _districtColor = Color(0xFF059669);

  // Tuman — qalin ajralib turadigan tashqi chegara + yengil to'ldirish.
  static const double _districtBorderWidth = 3;
  static const double _districtFillAlpha = 0.05;

  // Mahallalar — ingichka, "sekin" (past kontrast) to'r; to'ldirishsiz, shunda
  // tuman chegarasi va joriy mahalla urg'usi ustidan ustunlik qiladi.
  static const double _mahallaBorderWidth = 0.8;
  static const Color _mahallaBorderColor = Color(0x8C64748B); // ~55% alpha

  Future<ZoneBoundaries> load() async {
    final mahallaFeatures = await _load('mahalla');
    final districtFeatures = await _load('district');

    // Chizish tartibi: avval mahallalar (ingichka), so'ng tuman (qalin) —
    // shunda tuman chegarasi ustidan chiziladi va ajralib turadi.
    final polygons = <Polygon>[
      for (final f in mahallaFeatures)
        ..._polygonsOf(
          f,
          borderColor: _mahallaBorderColor,
          borderWidth: _mahallaBorderWidth,
          fillAlpha: 0,
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
        MahallaArea(name: f.name, parts: f.parts),
    ];

    return ZoneBoundaries(polygons: polygons, mahallas: mahallas);
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

        out.add(
          _ZoneFeature(
            name: _nameOf(map['properties'] as Map<String, dynamic>?),
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
  const ZoneBoundaries({required this.polygons, required this.mahallas});

  /// Xaritada chiziladigan tuman + mahalla poligonlari (tartibda).
  final List<Polygon> polygons;

  /// Lokal "qaysi mahalla" hisobi uchun mahalla hududlari (nom + halqalar).
  final List<MahallaArea> mahallas;

  static const ZoneBoundaries empty =
      ZoneBoundaries(polygons: [], mahallas: []);
}

/// Bitta mahalla hududi — ko'rsatiladigan [name] + bir yoki bir nechta poligon
/// [parts] (MultiPolygon mahallada bittadan ko'p). Nuqta shu hudud ichidami
/// ([contains]) tekshiruvi lokal ray-casting orqali bajariladi — hech qanday
/// tarmoq murojaati yo'q.
class MahallaArea {
  const MahallaArea({required this.name, required this.parts});

  final String name;
  final List<MahallaPolygon> parts;

  /// [point] shu mahallaning HAR QANDAY poligoni ichida bo'lsa `true`.
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
  const _ZoneFeature({required this.name, required this.parts});

  final String name;
  final List<MahallaPolygon> parts;
}
