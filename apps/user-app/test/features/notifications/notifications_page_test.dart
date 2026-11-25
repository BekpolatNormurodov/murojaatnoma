import 'package:app_core/app_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/features/notifications/presentation/bloc/notifications_cubit.dart';
import 'package:user_app/features/notifications/presentation/pages/notifications_page.dart';

class _Source implements NotificationsDataSource {
  int calls = 0;

  @override
  Future<List<NotificationItem>> fetch() async {
    calls++;
    return const [];
  }

  @override
  Future<void> markRead(String id) async {}

  @override
  Future<void> markAllRead() async {}
}

void main() {
  testWidgets('opening the page and pulling an empty list both reload', (
    tester,
  ) async {
    final source = _Source();
    final cubit = NotificationsCubit(dataSource: source);
    addTearDown(cubit.close);
    await cubit.load();
    expect(source.calls, 1);

    await tester.pumpWidget(
      BlocProvider.value(
        value: cubit,
        child: const MaterialApp(
          locale: Locale('uz'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: NotificationsPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(source.calls, 2);

    await tester.fling(
      find.byType(SingleChildScrollView),
      const Offset(0, 400),
      1000,
    );
    await tester.pumpAndSettle();
    expect(source.calls, 3);
  });
}
