import 'package:app_core/app_core.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/features/requests/presentation/bloc/request_detail_cubit.dart';
import 'package:user_app/features/requests/presentation/bloc/submit_request_cubit.dart';
import 'package:user_app/features/requests/presentation/pages/request_detail_page.dart';
import 'package:user_app/features/requests/presentation/pages/submit_request_page.dart';

import '../../support/fonts.dart';
import '../../support/small_screen.dart';

class _Detail extends MockCubit<RequestDetailState>
    implements RequestDetailCubit {}

class _Submit extends MockCubit<SubmitRequestState>
    implements SubmitRequestCubit {}

const _resolved = CitizenRequest(
  id: 'a1',
  kind: RequestKind.shikoyat,
  category: 'Elektr',
  title: "Ko'cha chirog'i yonmayapti",
  body: 'Uch kundan beri yonmayapti.',
  status: RequestStatus.javobBerildi,
  createdAt: '2026-10-01T07:25:00',
  attachmentsFailed: true,
);

void main() {
  setUpAll(loadTestFonts);

  testWidgets('detail: load errors shown; reopen sheet validates and '
      'survives closing (360x640)', (tester) async {
    useSmallScreen(tester);
    final cubit = _Detail();
    when(() => cubit.state).thenReturn(
      const RequestDetailLoaded(request: _resolved, messagesFailed: true),
    );
    when(() => cubit.reopen(any())).thenAnswer((_) async => null);

    await tester.pumpWidget(
      localizedApp(
        BlocProvider<RequestDetailCubit>.value(
          value: cubit,
          child: const RequestDetailPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text("Biriktirmalarni yuklab bo'lmadi"),
      150,
      scrollable: scrollable,
    );
    await tester.scrollUntilVisible(
      find.text("Xabarlarni yuklab bo'lmadi"),
      150,
      scrollable: scrollable,
    );
    final reopen = find.text("Muammo hal bo'lmadi");
    await tester.scrollUntilVisible(reopen, 150, scrollable: scrollable);
    await tester.ensureVisible(reopen);
    await tester.pumpAndSettle();
    await tester.tap(reopen);
    await tester.pumpAndSettle();

    // Klaviatura ochiq holat.
    tester.view.viewInsets = const FakeViewPadding(bottom: 280);
    await tester.pumpAndSettle();
    final field = find.widgetWithText(
      TextField,
      'Masalan: chiroq hali ham yonmayapti',
    );
    await tester.enterText(field, 'ok');
    await tester.ensureVisible(find.text('Qayta ochish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Qayta ochish'));
    await tester.pumpAndSettle();
    expect(find.text('Sababni yozing (kamida 3 harf)'), findsOneWidget);
    verifyNever(() => cubit.reopen(any()));

    await tester.enterText(find.byType(TextField).last, 'hali yonmayapti');
    await tester.ensureVisible(find.text('Qayta ochish'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Qayta ochish'));
    tester.view.resetViewInsets();
    await tester.pumpAndSettle();

    verify(() => cubit.reopen('hali yonmayapti')).called(1);
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 5));
    await drainFonts(tester);
  });

  testWidgets("detail: a staff reply's proof photo is shown and opens "
      '(360x640)', (tester) async {
    useSmallScreen(tester);
    final cubit = _Detail();
    when(() => cubit.state).thenReturn(
      const RequestDetailLoaded(
        request: _resolved,
        messages: [
          RequestMessage(
            id: 'm1',
            senderRole: RequestMessageSenderRole.employee,
            senderName: 'Hokimiyat',
            text: 'Tuzatildi',
            attachmentUrl: 'https://x.uz/uploads/proof.jpg',
            createdAt: '2026-11-01T10:00:00',
          ),
        ],
      ),
    );

    await tester.pumpWidget(
      localizedApp(
        BlocProvider<RequestDetailCubit>.value(
          value: cubit,
          child: const RequestDetailPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final proof = find.text('proof.jpg');
    await tester.scrollUntilVisible(
      proof,
      150,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.ensureVisible(proof);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(proof);
    await tester.pumpAndSettle();

    expect(find.byType(InteractiveViewer), findsOneWidget);
    await drainFonts(tester);
  });

  testWidgets('submit: no fake voice/file chips; partial upload offers retry '
      '(360x640)', (tester) async {
    useSmallScreen(tester);
    final cubit = _Submit();
    when(cubit.loadDefaultLocation).thenAnswer((_) async => null);
    when(cubit.retryAttachments).thenAnswer((_) async {});
    when(() => cubit.state).thenReturn(
      const SubmitRequestAttachmentsFailed(_resolved, [
        RequestAttachment(
          type: RequestAttachmentType.image,
          path: '/x.jpg',
          name: 'x.jpg',
        ),
      ], "Faylni yuklab bo'lmadi"),
    );
    final l10n = lookupAppLocalizations(const Locale('uz'));

    await tester.pumpWidget(
      localizedApp(
        BlocProvider<SubmitRequestCubit>.value(
          value: cubit,
          child: const SubmitRequestPage(initialKind: RequestKind.shikoyat),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(l10n.attachmentAddVoice), findsNothing);
    expect(find.text(l10n.attachmentAddFile), findsNothing);

    final retry = find.text('Qayta yuklash');
    await tester.scrollUntilVisible(
      retry,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.ensureVisible(retry);
    await tester.pumpAndSettle();
    expect(find.text(l10n.createRequestSubmit), findsNothing);
    await tester.tap(retry);

    verify(cubit.retryAttachments).called(1);
    expect(tester.takeException(), isNull);
    await drainFonts(tester);
  });
}
