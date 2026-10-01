import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/calls/presentation/bloc/meeting_cubit.dart';
import 'package:worker_app/features/calls/presentation/pages/meeting_page.dart';

class _MockMeetingCubit extends MockCubit<MeetingState> implements MeetingCubit {}

List<MeetingMember> people(int n) => [
  for (var i = 0; i < n; i++)
    MeetingMember(
      id: 'p$i',
      name: i.isEven ? 'ГУЛЯМОВ Абдулазиз Исмаилович' : 'Ali Valiyev',
      audio: i % 3 != 0,
      video: i.isEven,
      connected: i != 1,
    ),
];

Future<void> pumpPage(WidgetTester tester, MeetingState state, {double width = 360}) async {
  tester.view.physicalSize = Size(width, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final cubit = _MockMeetingCubit();
  when(() => cubit.state).thenReturn(state);
  when(() => cubit.localStream).thenReturn(null);
  when(() => cubit.streamOf(any())).thenReturn(null);
  await tester.pumpWidget(
    MaterialApp(
      home: BlocProvider<MeetingCubit>.value(value: cubit, child: const MeetingPage()),
    ),
  );
  await tester.pump();
}

void main() {
  for (final width in [320.0, 360.0]) {
    testWidgets('invite screen fits at ${width.toInt()}px', (tester) async {
      await pumpPage(
        tester,
        const MeetingState(
          phase: MeetingPhase.incoming,
          meetingId: 'm1',
          title: "Mirzo Ulug'bek tumani hokimligi haftalik selektor yig'ilishi",
          hostName: 'Bosh administrator',
        ),
        width: width,
      );
      expect(tester.takeException(), isNull);
      expect(find.text("Qo'shilish"), findsOneWidget);
      expect(find.text('Rad etish'), findsOneWidget);
    });

    for (final n in [0, 1, 4, 8]) {
      testWidgets('live grid with ${n + 1} people fits at ${width.toInt()}px', (tester) async {
        await pumpPage(
          tester,
          MeetingState(
            phase: MeetingPhase.live,
            meetingId: 'm1',
            title: 'Selektor',
            members: people(n),
            elapsed: const Duration(minutes: 12, seconds: 5),
          ),
          width: width,
        );
        expect(tester.takeException(), isNull);
        expect(find.text('Siz'), findsOneWidget);
        expect(find.text('${n + 1}'), findsOneWidget);
        if (n == 0) expect(find.text('Boshqa ishtirokchilar kutilmoqda…'), findsOneWidget);
      });
    }
  }

  testWidgets('audio-only join hides camera controls; muted peers show the badge', (tester) async {
    await pumpPage(
      tester,
      MeetingState(
        phase: MeetingPhase.live,
        meetingId: 'm1',
        title: 'T',
        hasCamera: false,
        camOn: false,
        micOn: false,
        members: people(3),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.bySemanticsLabel('Kamerani almashtirish'), findsNothing);
    expect(find.bySemanticsLabel('Ovozni yoqish'), findsOneWidget);
  });

  testWidgets('ended and error screens', (tester) async {
    await pumpPage(
      tester,
      const MeetingState(
        phase: MeetingPhase.ended,
        title: 'T',
        message: "Yig'ilish yakunlandi",
        elapsed: Duration(minutes: 3),
      ),
    );
    expect(find.text("Yig'ilish yakunlandi"), findsOneWidget);
    expect(find.text('03:00'), findsOneWidget);

    await pumpPage(
      tester,
      const MeetingState(phase: MeetingPhase.error, message: "Bu yig'ilish allaqachon tugagan"),
    );
    expect(find.text("Bu yig'ilish allaqachon tugagan"), findsOneWidget);
  });
}
