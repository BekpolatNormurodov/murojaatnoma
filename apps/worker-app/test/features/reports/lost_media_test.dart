import 'dart:io';

import 'package:app_core/app_core.dart';
import 'package:app_ui/app_ui.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mocktail/mocktail.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/repositories/reports_repository.dart';
import 'package:worker_app/features/reports/domain/usecases/submit_report.dart';
import 'package:worker_app/features/reports/domain/usecases/upload_report_file.dart';
import 'package:worker_app/features/reports/presentation/bloc/report_compose_cubit.dart';
import 'package:worker_app/features/reports/presentation/pages/report_compose_page.dart';

class _Picker extends Mock implements ImagePicker {}

class _Repo extends Mock implements ReportsRepository {}

class _File extends Fake implements XFile {
  @override
  String get path => '/tmp/lost.jpg';

  @override
  String get name => 'lost.jpg';

  @override
  Future<int> length() async => 1234;
}

void main() {
  setUpAll(() {
    registerFallbackValue(File('x'));
    registerFallbackValue(ReportAttachmentKind.image);
  });

  testWidgets('a photo picked before Android killed the app is recovered', (
    tester,
  ) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    final picker = _Picker();
    when(picker.retrieveLostData).thenAnswer(
      (_) async => LostDataResponse(
        file: _File(),
        files: [_File()],
        type: RetrieveType.image,
      ),
    );
    final repo = _Repo();
    when(
      () => repo.upload(
        file: any(named: 'file'),
        kind: any(named: 'kind'),
        fileName: any(named: 'fileName'),
        durationSec: any(named: 'durationSec'),
        onProgress: any(named: 'onProgress'),
      ),
    ).thenAnswer((_) async => const Left(ServerFailure('offline')));
    final cubit = ReportComposeCubit(
      uploadFile: UploadReportFile(repo),
      submitReport: SubmitReport(repo),
    );
    addTearDown(cubit.close);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        locale: const Locale('uz'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: BlocProvider.value(
          value: cubit,
          child: ReportComposePage(picker: picker),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));
    debugDefaultTargetPlatformOverride = null;
    expect(cubit.state.attachments.single.name, 'lost.jpg');
  });
}
