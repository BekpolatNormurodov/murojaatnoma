import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Backend'dagi `/zones/geojson` dan tuman + mahalla chegaralarini yuklab,
/// `flutter_map` `Polygon` ro'yxatiga aylantiradi. GeoJSON koordinatalari
/// `[lng, lat]` — `LatLng(lat, lng)` ga o'giriladi. Xato (offline/URL yo'q)
/// bo'lsa bo'sh ro'yxat qaytaradi (xarita baribir ishlaydi).
class ZoneBoundaryLoader {
  ZoneBoundaryLoader(this._dio);

  final Dio _dio;

  static const Color _districtColor = Color(0xFF059669);
  static const Color _mahallaColor = Color(0xFF64748B);

  Future<List<Polygon>> load() async {
    final result = <Polygon>[
      ...await _fetch('mahalla', _mahallaColor, 1, fillAlpha: 0),
      ...await _fetch('district', _districtColor, 2.5, fillAlpha: 0.05),
    ];
    return result;
  }

  Future<List<Polygon>> _fetch(
    String kind,
    Color color,
    double borderWidth, {
    required double fillAlpha,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/zones/geojson',
        queryParameters: <String, dynamic>{'kind': kind},
      );
      final features = (res.data?['features'] as List<dynamic>?) ?? const [];
      final polygons = <Polygon>[];
      for (final f in features) {
        final geometry = (f as Map<String, dynamic>)['geometry']
            as Map<String, dynamic>?;
        if (geometry == null) continue;
        final type = geometry['type'] as String?;
        final coordinates = geometry['coordinates'] as List<dynamic>?;
        if (coordinates == null) continue;

        if (type == 'Polygon') {
          _addRings(polygons, coordinates, color, borderWidth, fillAlpha);
        } else if (type == 'MultiPolygon') {
          for (final poly in coordinates) {
            _addRings(
              polygons,
              poly as List<dynamic>,
              color,
              borderWidth,
              fillAlpha,
            );
          }
        }
      }
      return polygons;
    } on Object {
      return const [];
    }
  }

  void _addRings(
    List<Polygon> out,
    List<dynamic> rings,
    Color color,
    double borderWidth,
    double fillAlpha,
  ) {
    if (rings.isEmpty) return;
    final outer = _ring(rings.first as List<dynamic>);
    final holes = <List<LatLng>>[];
    for (var i = 1; i < rings.length; i++) {
      holes.add(_ring(rings[i] as List<dynamic>));
    }
    out.add(
      Polygon<Object>(
        points: outer,
        holePointsList: holes.isEmpty ? null : holes,
        borderColor: color,
        borderStrokeWidth: borderWidth,
        color: fillAlpha > 0 ? color.withValues(alpha: fillAlpha) : null,
      ),
    );
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
