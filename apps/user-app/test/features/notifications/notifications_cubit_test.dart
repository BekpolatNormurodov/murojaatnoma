import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:user_app/core/cache/cache_service.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_api_data_source.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';

class _FakeSource implements NotificationsDataSource {
  _FakeSource(this.items);

  final List<NotificationItem> items;
  final read = <String>[];
  var readAll = 0;

  @override
  Future<List<NotificationItem>> fetch() async => items;

  @override
  Future<void> markRead(String id) async => read.add(id);

  @override
  Future<void> markAllRead() async => readAll++;
}

void main() {
  test('server rows map to the right kind and keep the murojaat link', () {
    final n = notificationFromApi({
      'id': 'x1',
      'title': 'Murojaatingiz rad etildi',
      'body': 'Sabab: Bu tuman vakolatida emas',
      'applicationId': 'a1',
      'isRead': false,
      'createdAt': '2026-10-02T09:00:00.000Z',
    });
    expect(n.type, NotificationType.requestRejected);
    expect(n.applicationId, 'a1');
    expect(n.read, isFalse);
    expect(
      notificationFromApi({'title': 'Mas’ul xodim biriktirildi'}).type,
      NotificationType.requestAssigned,
    );
    expect(
      notificationFromApi({'title': 'Hokimiyatdan yangi xabar'}).type,
      NotificationType.requestAnswered,
    );
  });

  test('reading marks it on the server and drops the unread count', () async {
    final now = DateTime.now();
    final source = _FakeSource([
      NotificationItem(
        id: 'a',
        type: NotificationType.requestResolved,
        title: 'Murojaatingiz hal qilindi',
        body: 'Natijani baholang',
        createdAt: now,
        applicationId: 'app1',
      ),
      NotificationItem(
        id: 'b',
        type: NotificationType.requestReceived,
        title: 'Murojaatingiz qabul qilindi',
        body: '5 kun ichida',
        createdAt: now.subtract(const Duration(days: 1)),
      ),
    ]);
    final cubit = NotificationsCubit(dataSource: source);
    await cubit.load();
    expect(cubit.unreadCount, 2);

    cubit.markRead('a');
    await Future<void>.delayed(Duration.zero);
    expect(cubit.unreadCount, 1);
    expect(source.read, ['a']);

    cubit.markRead('a'); // already read — no second request
    await Future<void>.delayed(Duration.zero);
    expect(source.read, ['a']);

    cubit.markAllRead();
    await Future<void>.delayed(Duration.zero);
    expect(cubit.unreadCount, 0);
    expect(source.readAll, 1);
    await cubit.close();
  });
  test('clear() on logout drops the list, the cache and the timer, and a '
      'response that arrives afterwards is ignored', () async {
    SharedPreferences.setMockInitialValues({});
    final cache = CacheService(await SharedPreferences.getInstance());
    final gate = Completer<List<NotificationItem>>();
    final source = _GatedSource(gate);
    final cubit = NotificationsCubit(dataSource: source, cache: cache);
    await cache.setJson(NotificationItem.cacheKey, [
      NotificationItem(
        id: 'old',
        type: NotificationType.requestReceived,
        title: 'Oldingi fuqaro',
        body: '',
        createdAt: DateTime(2026),
      ).toJson(),
    ]);

    cubit.startAutoRefresh(every: const Duration(milliseconds: 10));
    final pending = cubit.load();
    expect(cubit.state, isA<NotificationsLoaded>()); // from cache

    await cubit.clear();
    expect(cubit.state, const NotificationsLoading());
    expect(
      cache.getJsonList<NotificationItem>(
        NotificationItem.cacheKey,
        NotificationItem.fromJson,
      ),
      anyOf(isNull, isEmpty),
    );

    gate.complete([
      NotificationItem(
        id: 'late',
        type: NotificationType.requestReceived,
        title: 'Kechikkan javob',
        body: '',
        createdAt: DateTime(2026),
      ),
    ]);
    await pending;
    expect(cubit.state, const NotificationsLoading());

    final callsAfterClear = source.fetches;
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(source.fetches, callsAfterClear); // timer stopped
    await cubit.close();
  });
}

class _GatedSource implements NotificationsDataSource {
  _GatedSource(this.gate);

  final Completer<List<NotificationItem>> gate;
  int fetches = 0;

  @override
  Future<List<NotificationItem>> fetch() {
    fetches++;
    return gate.future;
  }

  @override
  Future<void> markRead(String id) async {}

  @override
  Future<void> markAllRead() async {}
}
