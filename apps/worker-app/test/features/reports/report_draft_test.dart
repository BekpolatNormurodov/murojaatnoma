import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:worker_app/core/recording/media_limits.dart';
import 'package:worker_app/features/reports/data/report_draft_store.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/usecases/get_zone_time.dart';
import 'package:worker_app/features/reports/domain/usecases/submit_report.dart';
import 'package:worker_app/features/reports/domain/usecases/upload_report_file.dart';
import 'package:worker_app/features/reports/presentation/bloc/report_compose_cubit.dart';
import 'package:worker_app/features/reports/presentation/bloc/zone_time_cubit.dart';

class _Upload extends Mock implements UploadReportFile {}

class _Submit extends Mock implements SubmitReport {}

class _Zone extends Mock implements GetZoneTime {}

void main() {
  setUpAll(() {
    registerFallbackValue(
      UploadReportFileParams(file: File('x'), kind: ReportAttachmentKind.file),
    );
    registerFallbackValue(
      const SubmitReportParams(day: 'd', text: '', attachments: []),
    );
  });

  late SharedPreferences prefs;
  late _Upload upload;
  late _Submit submit;
  String owner = 'A';

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    prefs = await SharedPreferences.getInstance();
    upload = _Upload();
    submit = _Submit();
    owner = 'A';
    when(() => upload(any())).thenAnswer(
      (_) async => const Right(
        ReportAttachment(kind: ReportAttachmentKind.file, url: '/uploads/a'),
      ),
    );
  });

  ReportComposeCubit cubit() => ReportComposeCubit(
    uploadFile: upload,
    submitReport: submit,
    drafts: ReportDraftStore(prefs, () => owner),
    clock: () => DateTime(2026, 11, 25),
  );

  test('draft survives leaving the page and is private to its owner', () async {
    final first = cubit()
      ..setDay('2026-11-23')
      ..setText('Uzun hisobot')
      ..addFile(
        kind: ReportAttachmentKind.file,
        path: '/gone.pdf',
        name: 'a.pdf',
        sizeBytes: 10,
      );
    await pumpEventQueue();
    await first.close();

    final again = cubit();
    expect(again.state.text, 'Uzun hisobot');
    expect(again.state.day, '2026-11-23');
    // Already uploaded: restored without a second upload.
    expect(again.state.attachments.single.uploaded?.url, '/uploads/a');
    verify(() => upload(any())).called(1);
    await again.close();

    owner = 'B';
    final other = cubit();
    expect(other.state.isEmpty, isTrue);
    await other.close();
  });

  test('failed send keeps the draft, success clears it', () async {
    final c = cubit()..setText('Matn');
    when(
      () => submit(any()),
    ).thenAnswer((_) async => const Left(ServerFailure('Internet yo\'q')));
    expect(await c.submit(), "Internet yo'q");
    expect(ReportDraftStore(prefs, () => 'A').read()?['text'], 'Matn');

    when(() => submit(any())).thenAnswer(
      (_) async => Right(
        DailyReport(id: '1', day: '2026-11-25', createdAt: DateTime(2026)),
      ),
    );
    expect(await c.submit(), isNull);
    expect(ReportDraftStore(prefs, () => 'A').read(), isNull);
    await c.close();
  });

  test('files above the gateway limit are rejected before upload', () async {
    final c = cubit();
    final error = c.addFile(
      kind: ReportAttachmentKind.video,
      path: '/v.mp4',
      name: 'v.mp4',
      sizeBytes: 25 * 1024 * 1024 - 100,
    );
    expect(error, contains('25 MB'));
    expect(kMaxUploadBytes, lessThan(25 * 1024 * 1024));
    verifyNever(() => upload(any()));
    await c.close();
  });

  test('recording limit stays under the upload cap', () {
    final bytes =
        (kVideoBitrate + kAudioBitrate) * kMaxVideoRecording.inSeconds ~/ 8;
    expect(bytes, lessThan(kMaxUploadBytes));
  });

  test('zone time covers today plus seven days', () {
    expect(ZoneTimeCubit(getZoneTime: _Zone()).days, 8);
  });
}
