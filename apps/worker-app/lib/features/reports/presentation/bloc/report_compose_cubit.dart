import 'dart:async';
import 'dart:io';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/core/recording/media_limits.dart';
import 'package:worker_app/core/utils/error_text.dart';
import 'package:worker_app/features/reports/data/report_draft_store.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/report_formatters.dart';
import 'package:worker_app/features/reports/domain/usecases/submit_report.dart';
import 'package:worker_app/features/reports/domain/usecases/upload_report_file.dart';

/// Biriktirmaning yuklash holati.
enum ComposeUploadStatus { uploading, uploaded, failed }

/// Yangi hisobot formasidagi bitta biriktirma — lokal fayl + yuklash holati.
class ComposeAttachment extends Equatable {
  const ComposeAttachment({
    required this.localId,
    required this.kind,
    required this.path,
    required this.name,
    this.sizeBytes,
    this.durationSec,
    this.status = ComposeUploadStatus.uploading,
    this.progress = 0,
    this.uploaded,
    this.error,
  });

  final String localId;
  final ReportAttachmentKind kind;

  /// Qurilmadagi fayl yo'li.
  final String path;
  final String name;
  final int? sizeBytes;
  final int? durationSec;
  final ComposeUploadStatus status;

  /// 0..1.
  final double progress;

  /// Server javobi (faqat `uploaded` holatida).
  final ReportAttachment? uploaded;
  final String? error;

  ComposeAttachment copyWith({
    ComposeUploadStatus? status,
    double? progress,
    ReportAttachment? uploaded,
    String? error,
  }) => ComposeAttachment(
    localId: localId,
    kind: kind,
    path: path,
    name: name,
    sizeBytes: sizeBytes,
    durationSec: durationSec,
    status: status ?? this.status,
    progress: progress ?? this.progress,
    uploaded: uploaded ?? this.uploaded,
    error: error,
  );

  @override
  List<Object?> get props => [
    localId,
    kind,
    path,
    name,
    sizeBytes,
    durationSec,
    status,
    progress,
    uploaded,
    error,
  ];
}

class ReportComposeState extends Equatable {
  const ReportComposeState({
    required this.day,
    required this.allowedDays,
    this.text = '',
    this.attachments = const [],
    this.submitting = false,
  });

  /// Tanlangan kun (`YYYY-MM-DD`).
  final String day;

  /// Bugun + oldingi 7 kun (eng yangisi birinchi).
  final List<String> allowedDays;
  final String text;
  final List<ComposeAttachment> attachments;
  final bool submitting;

  bool get isUploading =>
      attachments.any((a) => a.status == ComposeUploadStatus.uploading);
  bool get hasFailed =>
      attachments.any((a) => a.status == ComposeUploadStatus.failed);
  bool get isEmpty => text.trim().isEmpty && attachments.isEmpty;

  /// "Yuborish" faqat: hech narsa yuklanmayotgan/xato bo'lmagan, yuborish
  /// jarayonida emas va matn yoki biriktirma bor bo'lganda faol.
  bool get canSend => !submitting && !isUploading && !hasFailed && !isEmpty;

  ReportComposeState copyWith({
    String? day,
    String? text,
    List<ComposeAttachment>? attachments,
    bool? submitting,
  }) => ReportComposeState(
    day: day ?? this.day,
    allowedDays: allowedDays,
    text: text ?? this.text,
    attachments: attachments ?? this.attachments,
    submitting: submitting ?? this.submitting,
  );

  @override
  List<Object?> get props => [day, allowedDays, text, attachments, submitting];
}

/// Yangi kunlik hisobot formasi: har bir fayl biriktirilishi bilan DARHOL
/// yuklanadi (tile'da progress), "Yuborish" esa faqat hammasi yuklangach
/// `POST /daily-reports` qiladi. Hech qachon throw qilmaydi.
class ReportComposeCubit extends Cubit<ReportComposeState> {
  ReportComposeCubit({
    required UploadReportFile uploadFile,
    required SubmitReport submitReport,
    DateTime Function()? clock,
    ReportDraftStore? drafts,
  }) : _upload = uploadFile,
       _submit = submitReport,
       _drafts = drafts,
       super(_restored(_initial((clock ?? DateTime.now)()), drafts?.read())) {
    _seq = state.attachments.length;
    state.attachments
        .where((a) => a.status == ComposeUploadStatus.uploading)
        .toList()
        .forEach(_startUpload);
  }

  final ReportDraftStore? _drafts;
  bool _sent = false;

  /// Qoralama saqlanadimi (sahifa shu bo'yicha ogohlantiradi).
  bool get keepsDraft => _drafts != null;

  /// Qoralamani boshlang'ich holatga qo'llaydi: yuklanganlari qayta
  /// yuklanmaydi, qurilmadan o'chib ketgan fayllar tashlanadi.
  static ReportComposeState _restored(
    ReportComposeState initial,
    Map<String, dynamic>? draft,
  ) {
    if (draft == null) return initial;
    final attachments = <ComposeAttachment>[];
    final raw = draft['attachments'];
    if (raw is List) {
      for (final item in raw.whereType<Map<String, dynamic>>()) {
        final path = item['path'] as String? ?? '';
        final uploadedJson = item['uploaded'];
        final uploaded = uploadedJson is Map<String, dynamic>
            ? ReportAttachment.fromJson(uploadedJson)
            : null;
        if (uploaded == null && !File(path).existsSync()) continue;
        attachments.add(
          ComposeAttachment(
            localId: 'a${attachments.length + 1}',
            kind: ReportAttachmentKind.fromWire(item['kind'] as String?),
            path: path,
            name: item['name'] as String? ?? 'file',
            sizeBytes: item['sizeBytes'] as int?,
            durationSec: item['durationSec'] as int?,
            uploaded: uploaded,
            status: uploaded == null
                ? ComposeUploadStatus.uploading
                : ComposeUploadStatus.uploaded,
            progress: uploaded == null ? 0 : 1,
          ),
        );
      }
    }
    final day = draft['day'] as String?;
    return initial.copyWith(
      day: initial.allowedDays.contains(day) ? day : null,
      text: draft['text'] as String? ?? '',
      attachments: attachments,
    );
  }

  @override
  void onChange(Change<ReportComposeState> change) {
    super.onChange(change);
    final drafts = _drafts;
    if (drafts == null || _sent) return;
    final s = change.nextState;
    if (s.isEmpty) {
      unawaited(drafts.clear());
      return;
    }
    unawaited(
      drafts.write({
        'day': s.day,
        'text': s.text,
        'attachments': [
          for (final a in s.attachments)
            {
              'kind': a.kind.wire,
              'path': a.path,
              'name': a.name,
              'sizeBytes': a.sizeBytes,
              'durationSec': a.durationSec,
              'uploaded': a.uploaded?.toJson(),
            },
        ],
      }),
    );
  }

  final UploadReportFile _upload;
  final SubmitReport _submit;
  var _seq = 0;

  /// Bugun va oldingi shuncha kun uchun hisobot yozish mumkin.
  static const int backDays = 7;

  static ReportComposeState _initial(DateTime now) {
    final days = [
      for (var i = 0; i <= backDays; i++)
        ymd(DateTime(now.year, now.month, now.day - i)),
    ];
    return ReportComposeState(day: days.first, allowedDays: days);
  }

  void setDay(String day) {
    if (isClosed || !state.allowedDays.contains(day)) return;
    emit(state.copyWith(day: day));
  }

  void setText(String text) {
    if (isClosed || text == state.text) return;
    emit(state.copyWith(text: text));
  }

  /// Faylni ro'yxatga qo'shadi va yuklashni boshlaydi. `null` —
  /// qo'shildi; aks holda qo'shilmadi va ko'rsatiladigan sabab
  /// (10 ta chegara / 25 MB).
  String? addFile({
    required ReportAttachmentKind kind,
    required String path,
    required String name,
    int? sizeBytes,
    int? durationSec,
  }) {
    if (isClosed) return null;
    if (state.attachments.length >= SubmitReport.maxAttachments) {
      return "Ko'pi bilan ${SubmitReport.maxAttachments} ta fayl "
          'biriktirish mumkin';
    }
    if (sizeBytes != null && sizeBytes > UploadReportFile.maxBytes) {
      return '$kFileTooLargeMessage (${formatFileSize(sizeBytes)})';
    }
    final item = ComposeAttachment(
      localId: 'a${++_seq}',
      kind: kind,
      path: path,
      name: name,
      sizeBytes: sizeBytes,
      durationSec: durationSec,
    );
    emit(state.copyWith(attachments: [...state.attachments, item]));
    _startUpload(item);
    return null;
  }

  void retry(String localId) {
    final item = _find(localId);
    if (item == null || item.status != ComposeUploadStatus.failed) return;
    final restarted = item.copyWith(
      status: ComposeUploadStatus.uploading,
      progress: 0,
    );
    _replace(restarted);
    _startUpload(restarted);
  }

  void remove(String localId) {
    if (isClosed || state.submitting) return;
    emit(
      state.copyWith(
        attachments: state.attachments
            .where((a) => a.localId != localId)
            .toList(),
      ),
    );
  }

  void _startUpload(ComposeAttachment item) => unawaited(_runUpload(item));

  Future<void> _runUpload(ComposeAttachment item) async {
    var lastReported = 0.0;
    try {
      final result = await _upload(
        UploadReportFileParams(
          file: File(item.path),
          kind: item.kind,
          fileName: item.name,
          sizeBytes: item.sizeBytes,
          durationSec: item.durationSec,
          onProgress: (p) {
            // Har bir baytda emas — ~5% qadam bilan yangilaymiz.
            if (p - lastReported < 0.05 && p < 1) return;
            lastReported = p;
            final current = _find(item.localId);
            if (current == null ||
                current.status != ComposeUploadStatus.uploading) {
              return;
            }
            _replace(current.copyWith(progress: p));
          },
        ),
      );
      final current = _find(item.localId);
      // Yuklash davomida olib tashlangan (yoki sahifa yopilgan) — e'tiborsiz.
      if (current == null) return;
      result.fold(
        (failure) => _replace(
          current.copyWith(
            status: ComposeUploadStatus.failed,
            error: failure.message,
          ),
        ),
        (uploaded) => _replace(
          current.copyWith(
            status: ComposeUploadStatus.uploaded,
            progress: 1,
            uploaded: uploaded,
          ),
        ),
      );
    } on Object {
      final current = _find(item.localId);
      if (current != null) {
        _replace(
          current.copyWith(
            status: ComposeUploadStatus.failed,
            error: 'Yuklashda xatolik',
          ),
        );
      }
    }
  }

  /// Hisobotni yuboradi. `null` — muvaffaqiyat; aks holda ko'rsatiladigan
  /// xato matni (serverning o'zbekcha xabari ham).
  Future<String?> submit() async {
    if (isClosed) return null;
    final s = state;
    if (s.submitting) return null;
    if (s.isUploading) return 'Fayllar yuklanmoqda — biroz kuting';
    if (s.hasFailed) {
      return 'Yuklanmagan fayllarni qayta yuklang yoki olib tashlang';
    }
    if (s.isEmpty) {
      return 'Matn yozing yoki kamida bitta fayl biriktiring';
    }
    emit(s.copyWith(submitting: true));
    try {
      final result = await _submit(
        SubmitReportParams(
          day: s.day,
          text: s.text,
          attachments: [
            for (final a in s.attachments)
              if (a.uploaded case final uploaded?) uploaded,
          ],
        ),
      );
      if (result.isRight()) {
        _sent = true;
        await _drafts?.clear();
      }
      if (isClosed) return null;
      return result.fold<String?>((failure) {
        emit(state.copyWith(submitting: false));
        return failure.message;
      }, (_) => null);
    } on Object catch (e) {
      if (!isClosed) emit(state.copyWith(submitting: false));
      return unexpectedError(e);
    }
  }

  ComposeAttachment? _find(String localId) {
    for (final a in state.attachments) {
      if (a.localId == localId) return a;
    }
    return null;
  }

  void _replace(ComposeAttachment updated) {
    if (isClosed) return;
    emit(
      state.copyWith(
        attachments: [
          for (final a in state.attachments)
            if (a.localId == updated.localId) updated else a,
        ],
      ),
    );
  }
}
