import 'dart:math' as math;

import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Yandex Maps raster tile manzili — o'zbek (lotin) yozuvlari bilan
/// (`lang=uz_UZ`), retina uchun `scale=2` (512 px rasm 256 px katakka).
///
/// Yandex plitkalari EPSG:3395 (ellipsoidal Merkator) proyeksiyasida — shuning
/// uchun xarita [Epsg3395] bilan ishlatilishi SHART, aks holda (standart
/// EPSG:3857 bilan) mahalla poligonlari va markerlar Toshkent kengligida
/// plitkalardan ~20 km shimolga siljib chiziladi (Y farqi ≈ R·e²·sinφ).
const String kYandexTileUrlTemplate =
    'https://core-renderer-tiles.maps.yandex.net/tiles'
    '?l=map&x={x}&y={y}&z={z}&scale=2&lang=uz_UZ';

/// EPSG:3395 — World Mercator (WGS84 ellipsoidi). `flutter_map`da tayyor
/// yo'q; Leaflet'ning `L.CRS.EPSG3395` bilan aynan bir xil matematika
/// (ellipsoidal Merkator + 3857 dagi transformatsiya).
class Epsg3395 extends Crs {
  /// Yangi [Epsg3395] CRS.
  const Epsg3395()
    : super(code: 'EPSG:3395', infinite: false, wrapLng: const (-180, 180));

  static const double _scaleFactor = 0.5 / (math.pi * _EllipticalMercator.r);

  @override
  Projection get projection => const _EllipticalMercator();

  @override
  (double, double) transform(double x, double y, double scale) => (
    scale * (_scaleFactor * x + 0.5),
    scale * (-_scaleFactor * y + 0.5),
  );

  @override
  (double, double) untransform(double x, double y, double scale) => (
    (x / scale - 0.5) / _scaleFactor,
    (y / scale - 0.5) / -_scaleFactor,
  );

  @override
  (double, double) latLngToXY(LatLng latlng, double scale) {
    final (x, y) = projection.projectXY(latlng);
    return transform(x, y, scale);
  }

  @override
  LatLng pointToLatLng(math.Point<num> point, double zoom) {
    final (x, y) = untransform(
      point.x.toDouble(),
      point.y.toDouble(),
      scale(zoom),
    );
    return projection.unprojectXY(x, y);
  }

  @override
  Bounds<double>? getProjectedBounds(double zoom) {
    final s = scale(zoom);
    final (minX, minY) = transform(
      -_EllipticalMercator.maxX,
      _EllipticalMercator.minY,
      s,
    );
    final (maxX, maxY) = transform(
      _EllipticalMercator.maxX,
      _EllipticalMercator.maxY,
      s,
    );
    return Bounds<double>(math.Point(minX, minY), math.Point(maxX, maxY));
  }
}

/// Ellipsoidal (WGS84) Merkator proyeksiyasi — Leaflet `L.Projection.Mercator`.
class _EllipticalMercator extends Projection {
  // Bounds are served by Epsg3395.getProjectedBounds (Bounds has no const
  // constructor in flutter_map 7, so they can't live in this const ctor).
  const _EllipticalMercator() : super(null);

  /// Projected extent (metres) — same as Leaflet's Mercator bounds.
  static const double maxX = 20037508.34279;
  static const double minY = -15496570.73972;
  static const double maxY = 18764656.23138;

  static const double r = 6378137;

  /// Ekssentrisitet: sqrt(1 - (6356752.314245179 / r)^2).
  static const double e = 0.0818191908426215;

  static const double _maxLat = 89.99999;

  @override
  (double, double) projectXY(LatLng latlng) {
    final lat = latlng.latitude.clamp(-_maxLat, _maxLat);
    final phi = lat * math.pi / 180;
    final con = e * math.sin(phi);
    final ts =
        math.tan(math.pi / 4 - phi / 2) /
        math.pow((1 - con) / (1 + con), e / 2);
    final y = -r * math.log(math.max(ts, 1e-10));
    final x = r * latlng.longitude * math.pi / 180;
    return (x, y);
  }

  @override
  LatLng unprojectXY(double x, double y) {
    final ts = math.exp(-y / r);
    var phi = math.pi / 2 - 2 * math.atan(ts);
    for (var i = 0; i < 15; i++) {
      final con = e * math.sin(phi);
      final next =
          math.pi / 2 -
          2 * math.atan(ts * math.pow((1 - con) / (1 + con), e / 2)) -
          phi;
      phi += next;
      if (next.abs() < 1e-7) break;
    }
    return LatLng(phi * 180 / math.pi, x * 180 / math.pi / r);
  }
}
