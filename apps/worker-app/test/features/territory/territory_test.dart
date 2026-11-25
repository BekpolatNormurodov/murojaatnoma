import 'dart:async';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/territory/territory_card.dart';
import 'package:worker_app/features/territory/territory_service.dart';

import '../../support/fake_http.dart';

Territory _of(List<String> names) =>
    Territory([for (final n in names) AssignedMahalla(code: n, name: n)]);

void main() {
  test('parses names, legacy codes and rejects unrelated payloads', () {
    expect(
      Territory.tryParse({
        'assignedMahallas': [
          {'code': '1', 'name': 'Olmazor'},
        ],
      })!.mahallas.single.name,
      'Olmazor',
    );
    expect(
      Territory.tryParse({
        'assignedMahallaCodes': ['7'],
      })!.codes,
      {'7'},
    );
    expect(
      Territory.tryParse({'assignedMahallas': <Object>[]})!.wholeDistrict,
      isTrue,
    );
    // Unknown is NOT the whole district.
    expect(Territory.tryParse(<String, Object>{}), isNull);
  });

  test('GET /locations/me is read through the API loader', () async {
    final http = FakeHttp(
      (_) => json({
        'assignedMahallas': [
          {'code': '1', 'name': 'Bodomzor'},
        ],
      }),
    );
    final territory = await TerritoryService.apiLoader(http.dio())();
    expect(territory!.mahallas.single.name, 'Bodomzor');
    expect(http.requests.single.path, '/locations/me');
  });

  test(
    'territory:changed applies at once and signals only real changes',
    () async {
      var server = _of(['A']);
      var fail = false;
      final events = StreamController<Map<String, dynamic>>();
      final service = TerritoryService(
        load: () async => fail ? throw StateError('offline') : server,
        events: events.stream,
      );
      addTearDown(service.dispose);
      final changes = <Territory>[];
      service.changed.listen(changes.add);

      await service.refresh();
      await service.refresh();
      expect(changes, isEmpty, reason: 'first load and no-op are silent');

      server = _of(['B']);
      events.add({
        'assignedMahallas': [
          {'code': 'B', 'name': 'B'},
        ],
        'changedAt': '2026-11-25T05:00:00Z',
      });
      await pumpEventQueue();
      expect(service.territory.value, _of(['B']));
      expect(changes, [
        _of(['B']),
      ]);

      fail = true;
      await service.refresh();
      expect(service.territory.value, _of(['B']), reason: 'error keeps it');
      await events.close();
    },
  );

  test('a slow older answer never overwrites a newer territory', () async {
    final slow = Completer<Territory?>();
    var calls = 0;
    final events = StreamController<Map<String, dynamic>>();
    final service = TerritoryService(
      load: () async => switch (++calls) {
        1 => _of(['A']),
        2 => await slow.future,
        _ => _of(['B']),
      },
      events: events.stream,
    );
    addTearDown(service.dispose);
    final changes = <Territory>[];
    service.changed.listen(changes.add);

    await service.refresh();
    final stale = service.refresh(); // started before the admin's change
    events.add({
      'assignedMahallas': [
        {'code': 'B', 'name': 'B'},
      ],
    });
    await pumpEventQueue();
    slow.complete(_of(['A']));
    await stale;
    await pumpEventQueue();

    expect(service.territory.value, _of(['B']));
    expect(changes, [
      _of(['B']),
    ]);
    await events.close();
  });

  test("a late answer never leaks into the next employee's session", () async {
    final gate = Completer<Territory?>();
    final service = TerritoryService(load: () => gate.future);
    addTearDown(service.dispose);
    final pending = service.refresh();
    service.clear();
    gate.complete(_of(['A']));
    await pending;
    expect(service.territory.value, isNull);
  });

  testWidgets('card lists mahalla names, expands and hides when unknown', (
    tester,
  ) async {
    final service = TerritoryService(load: () async => null);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: TerritoryCard(service: service)),
      ),
    );
    expect(find.byKey(const Key('territory_card')), findsNothing);

    service.territory.value = _of([for (var i = 1; i <= 9; i++) 'Mahalla $i']);
    await tester.pump();
    expect(find.text('9 ta mahalla'), findsOneWidget);
    expect(find.text('Mahalla 6'), findsOneWidget);
    expect(find.text('Mahalla 7'), findsNothing);
    await tester.tap(find.text('Yana 3 ta'));
    await tester.pump();
    expect(find.text('Mahalla 9'), findsOneWidget);

    service.territory.value = const Territory([]);
    await tester.pump();
    expect(find.text('Butun tuman'), findsOneWidget);
  });
}
