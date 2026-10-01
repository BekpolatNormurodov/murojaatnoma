import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:worker_app/features/map/data/yandex_map.dart';

void main() {
  const crs = Epsg3395();

  test('Tashkent lands on the same Yandex tile as the reference formula', () {
    // Reference (Python, ellipsoidal Mercator): z=15 -> tile (22695, 12271).
    final (x, y) = crs.latLngToXY(const LatLng(41.31, 69.34), crs.scale(15));
    expect((x / 256).floor(), 22695);
    expect((y / 256).floor(), 12271);
  });

  test('project -> unproject round-trips within a centimetre', () {
    const p = LatLng(41.3354, 69.3737);
    final point = crs.latLngToPoint(p, 17);
    final back = crs.pointToLatLng(point, 17);
    expect(back.latitude, closeTo(p.latitude, 1e-7));
    expect(back.longitude, closeTo(p.longitude, 1e-7));
  });

  test('Y differs from spherical Mercator by R*e^2*sin(phi) (why 3395)', () {
    const lat = 41.31;
    final (_, y3395) = crs.projection.projectXY(const LatLng(lat, 69.34));
    const r = 6378137.0;
    const e = 0.0818191908426215;
    const phi = lat * math.pi / 180;
    final y3857 = r * math.log(math.tan(math.pi / 4 + phi / 2));
    final s = e * math.sin(phi);
    final expected = -r * (e / 2) * math.log((1 - s) / (1 + s));
    // ~28 km of projected Y: overlays on a 3857 map would be ~20 km off.
    expect(y3857 - y3395, closeTo(expected, 0.01));
    expect(y3857 - y3395, inInclusiveRange(27000, 29000));
  });
}
