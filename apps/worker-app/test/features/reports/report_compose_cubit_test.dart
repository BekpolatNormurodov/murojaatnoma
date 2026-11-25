import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';
import 'package:worker_app/features/reports/domain/usecases/submit_report.dart';
import 'package:worker_app/features/reports/domain/usecases/upload_report_file.dart';
import 'package:worker_app/features/reports/presentation/bloc/report_compose_cubit.dart';

class _FakeRepository implements ReportsRepository {
  final uploads = <Completer<Either<Failure, ReportAttachment>>>[];
  List<ReportAttachment>? submittedAttachments;
  String? submittedDay;
  String? submittedText;
  Either<Failure, DailyReport>? submitResult;

  @override
  Future<Either<Failure, ReportAttachment>> upload({
    required File file,
    required ReportAttachmentKind kind,
    String? fileName,
    int? durationSec,
    void Function(double progress)? onProgress,
  }) {
    final c = Completer<Either<Failure, ReportAttachment>>();
    uploads.add(c);
    return c.future;
  }

  @override
  Future<Either<Failure, DailyReport>> submit({
    required String day,
    required String text,
    required List<ReportAttachment> attachments,
  }) async {
    submittedDay = day;
    submittedText = text;
    submittedAttachments = attachments;
    return submitResult ??
        Right(DailyReport(id: '1', day: day, createdAt: DateTime(2026)));
  }

  @override
  Future<Either<Failure, Unit>> delete(String id) async => const Right(unit);

  @override
  Future<Either<Failure, List<DailyReport>>> myReports({int days = 30}) async =>
      const Right([]);

  @override
  Future<Either<Failure, ZoneTimeReport>> zoneTime({int days = 7}) async =>
      const Right(ZoneTimeReport(days: []));
}

void main() {
  late _FakeRepository repo;
  late ReportComposeCubit cubit;

  setUp(() {
    repo = _FakeRepository();
    cubit = ReportComposeCubit(
      uploadFile: UploadReportFile(repo),
      submitReport: SubmitReport(repo),
      clock: () => DateTime(2026, 11, 25, 15),
    );
  });

  tearDown(() => cubit.close());

  test('day selector: today + previous 7 days, default today', () {
    expect(cubit.state.day, '2026-11-25');
    expect(cubit.state.allowedDays, hasLength(8));
    expect(cubit.state.allowedDays.last, '2026-11-18');
    cubit.setDay('2026-11-10');
    expect(cubit.state.day, '2026-11-25', reason: 'out of range ignored');
    cubit.setDay('2026-11-20');
    expect(cubit.state.day, '2026-11-20');
  });

  test('send disabled when empty, enabled with text', () {
    expect(cubit.state.canSend, isFalse);
    cubit.setText('   ');
    expect(cubit.state.canSend, isFalse);
    cubit.setText('Ish qilindi');
    expect(cubit.state.canSend, isTrue);
  });

  test('25 MB limit rejected client-side', () {
    final error = cubit.addFile(
      kind: ReportAttachmentKind.video,
      path: '/tmp/v.mp4',
      name: 'v.mp4',
      sizeBytes: 26 * 1024 * 1024,
    );
    expect(error, contains('25 MB'));
    expect(cubit.state.attachments, isEmpty);
    expect(repo.uploads, isEmpty);
  });

  test('10 attachment limit', () {
    for (var i = 0; i < 10; i++) {
      expect(
        cubit.addFile(
          kind: ReportAttachmentKind.image,
          path: '/tmp/$i.jpg',
          name: '$i.jpg',
          sizeBytes: 100,
        ),
        isNull,
      );
    }
    final error = cubit.addFile(
      kind: ReportAttachmentKind.image,
      path: '/tmp/x.jpg',
      name: 'x.jpg',
    );
    expect(error, contains('10'));
    expect(cubit.state.attachments, hasLength(10));
  });

  test('upload first, then POST with uploaded attachments', () async {
    cubit.addFile(
      kind: ReportAttachmentKind.voice,
      path: '/tmp/a.m4a',
      name: 'a.m4a',
      sizeBytes: 100,
      durationSec: 4,
    );
    expect(cubit.state.isUploading, isTrue);
    expect(cubit.state.canSend, isFalse);
    expect(await cubit.submit(), contains('yuklanmoqda'));

    const uploaded = ReportAttachment(
      kind: ReportAttachmentKind.voice,
      url: '/uploads/a.m4a',
      durationSec: 4,
    );
    repo.uploads.single.complete(const Right(uploaded));
    await Future<void>.delayed(Duration.zero);

    expect(cubit.state.attachments.single.status, ComposeUploadStatus.uploaded);
    expect(cubit.state.canSend, isTrue);

    expect(await cubit.submit(), isNull);
    expect(repo.submittedDay, '2026-11-25');
    expect(repo.submittedAttachments, [uploaded]);
  });

  test('failed upload blocks send until retried or removed', () async {
    cubit.addFile(
      kind: ReportAttachmentKind.file,
      path: '/tmp/b.pdf',
      name: 'b.pdf',
      sizeBytes: 100,
    );
    repo.uploads.single.complete(const Left(ServerFailure('Fayl turi xato')));
    await Future<void>.delayed(Duration.zero);

    final a = cubit.state.attachments.single;
    expect(a.status, ComposeUploadStatus.failed);
    expect(a.error, 'Fayl turi xato');
    expect(cubit.state.canSend, isFalse);

    cubit.retry(a.localId);
    expect(
      cubit.state.attachments.single.status,
      ComposeUploadStatus.uploading,
    );
    expect(repo.uploads, hasLength(2));

    cubit.remove(a.localId);
    expect(cubit.state.attachments, isEmpty);
    // Olib tashlangandan keyin kelgan natija e'tiborsiz qoladi.
    repo.uploads.last.complete(
      const Right(ReportAttachment(kind: ReportAttachmentKind.file, url: 'u')),
    );
    await Future<void>.delayed(Duration.zero);
    expect(cubit.state.attachments, isEmpty);
  });

  test('server validation message is surfaced and state recovers', () async {
    repo.submitResult = const Left(
      ServerFailure("Kun 7 kundan eski bo'lmasin"),
    );
    cubit.setText('matn');
    expect(await cubit.submit(), "Kun 7 kundan eski bo'lmasin");
    expect(cubit.state.submitting, isFalse);
    expect(cubit.state.canSend, isTrue);
  });
}
