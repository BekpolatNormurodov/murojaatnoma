import 'package:flutter_test/flutter_test.dart';
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
}
