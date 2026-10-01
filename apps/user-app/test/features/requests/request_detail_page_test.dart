import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:user_app/features/requests/presentation/pages/request_detail_page.dart';

class _MockDetailCubit extends MockCubit<RequestDetailState>
    implements RequestDetailCubit {}

const _request = CitizenRequest(
  id: 'a1',
  kind: RequestKind.ariza,
  category: 'Elektr',
  title: "Ko'cha chirog'i yonmayapti",
  body: 'Uch kundan beri yonmayapti.',
  status: RequestStatus.korilmoqda,
  createdAt: '2026-10-01T07:25:00',
  address: "Yalang'och MFY",
  dueAt: '2099-10-06T07:25:00',
  history: [
    RequestHistoryEvent(type: 'CREATED', createdAt: '2026-10-01T07:25:00'),
    RequestHistoryEvent(
      type: 'ASSIGNED',
      createdAt: '2026-10-01T09:25:00',
      employeeName: 'Gulnora Yusupova',
    ),
    RequestHistoryEvent(
      type: 'STATUS_CHANGED',
      createdAt: '2026-10-01T09:25:00',
      toStatus: 'IN_PROGRESS',
    ),
  ],
);

void main() {
  testWidgets('shows the murojaat path: times, assignee, deadline, history', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final cubit = _MockDetailCubit();
    when(
      () => cubit.state,
    ).thenReturn(const RequestDetailLoaded(request: _request));

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider<RequestDetailCubit>.value(
          value: cubit,
          child: const RequestDetailPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text("Ko'rib chiqilmoqda"), findsOneWidget);
    expect(find.text('01.10, 09:25'), findsOneWidget); // step time
    expect(find.text('Gulnora Yusupova'), findsOneWidget); // assignee row
    expect(find.text("Yalang'och MFY"), findsOneWidget);
    expect(find.text('Murojaat tarixi'), findsOneWidget);
    expect(find.text("Mas'ul xodim: Gulnora Yusupova"), findsOneWidget);
  });
}
