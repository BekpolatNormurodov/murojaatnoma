import 'dart:async';
import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dartz/dartz.dart';
// Ilova hali `material_ui`ga ko'chirilmagan (Flutter 3.47+ deprecation).
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';
import 'package:worker_app/features/reports/domain/usecases/delete_report.dart';
import 'package:worker_app/features/reports/domain/usecases/get_my_reports.dart';
import 'package:worker_app/features/reports/domain/usecases/get_zone_time.dart';
import 'package:worker_app/features/reports/domain/usecases/submit_report.dart';
import 'package:worker_app/features/reports/domain/usecases/upload_report_file.dart';
import 'package:worker_app/features/reports/presentation/bloc/report_compose_cubit.dart';
import 'package:worker_app/features/reports/presentation/bloc/reports_cubit.dart';
import 'package:worker_app/features/reports/presentation/bloc/zone_time_cubit.dart';
import 'package:worker_app/features/reports/presentation/pages/report_compose_page.dart';
import 'package:worker_app/features/reports/presentation/pages/reports_page.dart';

/// Kichik ekran (360×640) + katta shrift (2.0x) — hech qanday RenderFlex
/// overflow yoki boshqa istisno bo'lmasligi kerak.
class _Repo implements ReportsRepository {
  _Repo({this.reports = const [], this.failList = false});


  final List<DailyReport> reports;
  final bool failList;
  final pendingUploads = <Completer<Either<Failure, ReportAttachment>>>[];

  @override
  Future<Either<Failure, List<DailyReport>>> myReports({int days = 30}) async =>
      failList
      ? const Left(ServerFailure("Serverga ulanib bo'lmadi"))
      : Right(reports);

  @override
  Future<Either<Failure, ZoneTimeReport>> zoneTime({int days = 7}) async {
    final now = DateTime.now();
    DateTime at(int d, int h, int m) =>
        DateTime(now.year, now.month, now.day - d, h, m);
    return Right(
      ZoneTimeReport(
        days: [
          ZoneDay(
            date: _ymd(at(0, 0, 0)),
            zoneMinutes: 320,
            outsideMinutes: 45,
            activeMinutes: 365,
            firstAt: at(0, 9, 12),
            lastAt: at(0, 15, 17),
            byMahalla: [
              for (var i = 0; i < 10; i++)
                MahallaTime(
                  name: i == 9 ? null : 'Juda uzun nomli mahalla raqam $i',
                  minutes: 130 - i,
                  inside: i != 9,
                ),
            ],
            stretches: [
              ZoneStretch(
                from: at(0, 9, 12),
                to: at(0, 11, 40),
                minutes: 148,
                inside: true,
                mahallaName: "Juda uzun nomli Mirzo Ulug'bek mahallasi",
              ),
              ZoneStretch(
                from: at(0, 11, 40),
                to: at(0, 12, 25),
                minutes: 45,
                inside: false,
              ),
            ],
          ),
          for (var i = 1; i < 7; i++) ZoneDay(date: _ymd(at(i, 0, 0))),
        ],
      ),
    );
  }

  @override
  Future<Either<Failure, ReportAttachment>> upload({
    required File file,
    required ReportAttachmentKind kind,
    String? fileName,
    int? durationSec,
    void Function(double progress)? onProgress,
  }) {
    final c = Completer<Either<Failure, ReportAttachment>>();
    pendingUploads.add(c);
    return c.future;
  }

  @override
  Future<Either<Failure, DailyReport>> submit({
    required String day,
    required String text,
    required List<ReportAttachment> attachments,
  }) async => Right(DailyReport(id: 'x', day: day, createdAt: DateTime.now()));

  @override
  Future<Either<Failure, Unit>> delete(String id) async => const Right(unit);
}

String _ymd(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

List<DailyReport> _sampleReports() {
  final now = DateTime.now();
  final y = now.subtract(const Duration(days: 1));
  return [
    DailyReport(
      id: 'today',
      day: _ymd(now),
      createdAt: now,
      text: 'Uzun matn ' * 60,
      attachments: const [
        ReportAttachment(
          kind: ReportAttachmentKind.voice,
          url: '/nonexistent/voice.m4a',
          durationSec: 75,
        ),
        ReportAttachment(
          kind: ReportAttachmentKind.image,
          url: '/nonexistent/a.jpg',
        ),
        ReportAttachment(
          kind: ReportAttachmentKind.video,
          url: '/nonexistent/v.mp4',
          fileName: 'video_juda_uzun_nomli_fayl_2026_11_25_final_v2.mp4',
          fileSize: 12 * 1024 * 1024,
          durationSec: 95,
        ),
        ReportAttachment(
          kind: ReportAttachmentKind.file,
          url: '/nonexistent/d.pdf',
          fileName: 'Dalolatnoma_juda_uzun_nomli_hujjat_tuman_hokimligi.pdf',
          fileSize: 248000,
        ),
      ],
    ),
    DailyReport(id: 'y', day: _ymd(y), createdAt: y, text: 'Kecha'),
  ];
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view
    ..physicalSize = const Size(360 * 3, 640 * 3)
    ..devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, inner) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: const TextScaler.linear(2)),
        child: inner!,
      ),
      home: child,
    ),
  );
  // Kirish animatsiyalari (flutter_animate kechikishlari) tugashi uchun.
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  Widget reportsPage(_Repo repo, {int tab = 0}) => MultiBlocProvider(
    providers: [
      BlocProvider(
        create: (_) => ReportsCubit(
          getMyReports: GetMyReports(repo),
          deleteReport: DeleteReport(repo),
        )..load(),
      ),
      BlocProvider(
        create: (_) => ZoneTimeCubit(getZoneTime: GetZoneTime(repo))..load(),
      ),
    ],
    child: ReportsPage(initialTab: tab),
  );

  testWidgets('reports list renders all attachment kinds without overflow', (
    tester,
  ) async {
    await _pump(tester, reportsPage(_Repo(reports: _sampleReports())));
    expect(tester.takeException(), isNull);
    expect(find.text('Kunlik hisobot'), findsOneWidget);
    expect(find.textContaining('Bugun'), findsWidgets);
    // Bugungi hisobotda o'chirish tugmasi bor.
    expect(find.byTooltip("O'chirish"), findsOneWidget);
    await tester.drag(find.byType(ListView).first, const Offset(0, -1500));
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);
  });

  testWidgets('empty and error states render', (tester) async {
    await _pump(tester, reportsPage(_Repo()));
    expect(find.text("Hali hisobot yo'q"), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.pumpWidget(const SizedBox());
    await _pump(tester, reportsPage(_Repo(failList: true)));
    expect(find.text("Serverga ulanib bo'lmadi"), findsOneWidget);
    expect(find.text('Qayta urinish'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  });

  testWidgets('zone-time tab renders stretches without overflow', (
    tester,
  ) async {
    await _pump(tester, reportsPage(_Repo(), tab: 1));
    expect(tester.takeException(), isNull);
    expect(find.textContaining('5 soat 20 daq'), findsWidgets);
    await tester.scrollUntilVisible(
      find.textContaining('09:12 – 11:40 · Hududda'),
      200,
      scrollable: find.byType(Scrollable).last,
    );
    expect(find.textContaining('09:12 – 11:40 · Hududda'), findsOneWidget);
    expect(tester.takeException(), isNull);
    final emptyDay = find.text("Bu kunda joylashuv ma'lumoti yo'q");
    for (var i = 0; i < 20 && emptyDay.evaluate().isEmpty; i++) {
      await tester.drag(find.byType(Scrollable).last, const Offset(0, -300));
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(emptyDay, findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('compose page: send disabled when empty, tiles fit', (
    tester,
  ) async {
    final repo = _Repo();
    final cubit = ReportComposeCubit(
      uploadFile: UploadReportFile(repo),
      submitReport: SubmitReport(repo),
    );
    addTearDown(cubit.close);
    await _pump(
      tester,
      BlocProvider.value(value: cubit, child: const ReportComposePage()),
    );
    expect(tester.takeException(), isNull);

    AppButton sendButton() =>
        tester.widget<AppButton>(find.byKey(const Key('report_send_button')));
    expect(sendButton().onPressed, isNull);

    cubit
      ..addFile(
        kind: ReportAttachmentKind.file,
        path: '/tmp/a.pdf',
        name: 'Juda_uzun_nomli_hujjat_fayli_tuman_hokimligi_2026.pdf',
        sizeBytes: 1024 * 1024,
      )
      ..addFile(
        kind: ReportAttachmentKind.voice,
        path: '/tmp/v.m4a',
        name: 'Ovozli xabar.m4a',
        sizeBytes: 2048,
        durationSec: 33,
      );
    repo.pendingUploads.last.complete(const Left(ServerFailure('Xato')));
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
    expect(sendButton().onPressed, isNull, reason: 'uploading/failed');

    await tester.enterText(find.byType(TextField), 'Bugungi ish');
    await tester.pump();
    expect(sendButton().onPressed, isNull, reason: 'still uploading');

    repo.pendingUploads.first.complete(
      const Right(ReportAttachment(kind: ReportAttachmentKind.file, url: 'u')),
    );
    await tester.pump();
    final failedId = cubit.state.attachments
        .firstWhere((a) => a.status == ComposeUploadStatus.failed)
        .localId;
    cubit.remove(failedId);
    await tester.pump();
    expect(sendButton().onPressed, isNotNull);
    expect(tester.takeException(), isNull);
  });
}
