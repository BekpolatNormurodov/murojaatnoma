import 'package:flutter_test/flutter_test.dart';
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

    expect(result.workZoneIsAssigned, isTrue);
    expect(result.workZone.map((m) => m.code), ['1090095']);
  });
}
