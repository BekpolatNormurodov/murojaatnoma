import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:worker_app/features/map/data/zone_boundary_loader.dart';

import '../../support/fake_http.dart';

/// `GET /zones/geojson` shape as produced by the backend (`ZonesService`):
/// the mahalla code is in `properties.code`.
Map<String, Object> _collection(List<(String, double)> zones) => {
  'type': 'FeatureCollection',
  'features': [
    for (final (code, lng) in zones)
      {
        'type': 'Feature',
        'properties': {'code': code, 'name_uz_lt': 'Mahalla $code'},
        'geometry': {
          'type': 'Polygon',
          'coordinates': [
            [
              [lng, 41.0],
              [lng + 0.01, 41.0],
              [lng + 0.01, 41.01],
              [lng, 41.0],
            ],
          ],
        },
      },
  ],
};

void main() {
  test('assigned mahallas are matched by the backend code property', () async {
    final http = FakeHttp(
      (options) => json(
        options.queryParameters['kind'] == 'mahalla'
            ? _collection([('1090106', 69.30), ('1090095', 69.32)])
            : _collection([('1726269', 69.20)]),
      ),
    );

    final result = await ZoneBoundaryLoader(
      http.dio(),
    ).load(assignedCodes: {'1090095'});

    expect(result.unassigned, isFalse);
    expect(result.workZone.map((m) => m.code), ['1090095']);
  });

  test(
    'no assigned mahalla is no territory, never the whole district',
    () async {
      final http = FakeHttp(
        (options) => json(
          options.queryParameters['kind'] == 'mahalla'
              ? _collection([('1090106', 69.30)])
              : _collection([('1726269', 69.30)]),
        ),
      );
      final loader = ZoneBoundaryLoader(http.dio());
      const insideDistrict = LatLng(41.003, 69.308);

      final none = await loader.load(assignedCodes: const {});
      expect(none.unassigned, isTrue);
      expect(none.workZone, isEmpty);
      expect(insideWorkZone(insideDistrict, none), isFalse);

      // An unknown assignment (offline) is not reported as "none assigned".
      final unknown = await loader.load();
      expect(unknown.unassigned, isFalse);
      expect(unknown.workZone, isEmpty);
    },
  );
}
