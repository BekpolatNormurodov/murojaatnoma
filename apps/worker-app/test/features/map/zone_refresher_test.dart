import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:worker_app/features/map/data/zone_boundary_loader.dart';
import 'package:worker_app/features/map/data/zone_refresher.dart';

ZoneBoundaries _boundaries(Set<String> codes) => ZoneBoundaries(
  polygons: [
    Polygon(points: const [LatLng(0, 0), LatLng(0, 1), LatLng(1, 1)]),
  ],
  mahallas: const [MahallaArea(name: 'M', code: '1', parts: [])],
  workZone: const [],
  workZoneIsAssigned: codes.isNotEmpty,
  bounds: null,
);

void main() {
  test('zone changes redraw; a failed request keeps the assignment', () async {
    MyZone? answer = const MyZone(
      assignedMahallaCodes: ['1'],
      insideAssignedZone: false,
    );
    final loaded = <Set<String>>[];
    final refresher = ZoneRefresher(
      loadZone: () async => answer,
      loadBoundaries: (codes) async {
        loaded.add(codes);
        return _boundaries(codes);
      },
    );
    expect(await refresher.refresh(), isTrue);
    expect(refresher.assignedCodes, {'1'});
    expect(refresher.serverInside, isFalse);

    answer = null; // 502
    expect(await refresher.refresh(), isFalse);
    expect(refresher.assignedCodes, {'1'});
    expect(loaded, hasLength(1));

    answer = const MyZone(
      assignedMahallaCodes: ['2'],
      insideAssignedZone: true,
    );
    expect(await refresher.refresh(), isTrue);
    expect(refresher.assignedCodes, {'2'});

    // The admin removes every mahalla.
    answer = MyZone.empty;
    expect(await refresher.refresh(), isTrue);
    expect(refresher.assignedCodes, isEmpty);
    expect(refresher.boundaries.workZoneIsAssigned, isFalse);
  });

  test('a failed geojson load does not erase drawn boundaries', () async {
    var codes = ['1'];
    var geojson = true;
    final refresher = ZoneRefresher(
      loadZone: () async =>
          MyZone(assignedMahallaCodes: codes, insideAssignedZone: null),
      loadBoundaries: (c) async =>
          geojson ? _boundaries(c) : ZoneBoundaries.empty,
    );
    await refresher.refresh();
    codes = ['2'];
    geojson = false;
    expect(await refresher.refresh(), isFalse);
    expect(refresher.boundaries.polygons, isNotEmpty);
    geojson = true;
    expect(await refresher.refresh(), isTrue); // retried
  });
}
