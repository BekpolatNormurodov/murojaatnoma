import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/auth/presentation/bloc/auth_cubit.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/presentation/pages/meeting_call_page.dart';

class _Auth extends MockCubit<AuthState> implements AuthCubit {}

final _meeting = Meeting(
  id: 'm1',
  title: 'Yig‘ilish',
  startAt: '2026-11-25T10:00:00',
  durationMin: 30,
  host: 'Hokim',
  participants: [],
  status: MeetingStatus.values.first,
);

void main() {
  const channel = MethodChannel('flutter.baseflow.com/permissions/methods');

  testWidgets('a denied camera is not requested again on resume', (
    tester,
  ) async {
    final calls = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, (
      call,
    ) async {
      calls.add(call.method);
      if (call.method == 'requestPermissions') {
        return {for (final p in call.arguments as List) p: 0};
      }
      return 0;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        channel,
        null,
      ),
    );
    final auth = _Auth();
    when(() => auth.state).thenReturn(const AuthState());

    await tester.pumpWidget(
      BlocProvider<AuthCubit>.value(
        value: auth,
        child: MaterialApp(
          theme: AppTheme.light,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Builder(
            builder: (context) => TextButton(
              onPressed: () => showMeetingCallScreen(context, _meeting),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 200));
    }

    // The permission activity itself produces inactive -> resumed.
    for (var i = 0; i < 3; i++) {
      tester.binding
        ..handleAppLifecycleStateChanged(AppLifecycleState.inactive)
        ..handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump(const Duration(milliseconds: 200));
    }

    expect(calls.where((c) => c == 'requestPermissions'), hasLength(1));
    expect(calls, contains('checkPermissionStatus'));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  });
}
