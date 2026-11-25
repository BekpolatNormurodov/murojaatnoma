import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/reports/domain/entities/daily_report.dart';
import 'package:worker_app/features/reports/domain/usecases/delete_report.dart';
import 'package:worker_app/features/reports/domain/usecases/get_my_reports.dart';
import 'package:worker_app/core/utils/error_text.dart';

part 'reports_state.dart';

/// "Kunlik hisobot" ro'yxati (so'nggi 30 kun) — yuklash, pull-to-refresh
/// va bugungi hisobotni o'chirish. Hech qachon throw qilmaydi.
class ReportsCubit extends Cubit<ReportsState> {
  ReportsCubit({
    required GetMyReports getMyReports,
    required DeleteReport deleteReport,
    this.days = 30,
  }) : _getMyReports = getMyReports,
       _deleteReport = deleteReport,
       super(const ReportsLoading());

  final GetMyReports _getMyReports;
  final DeleteReport _deleteReport;
  final int days;

  /// [silent] — pull-to-refresh: eski ro'yxat ko'rinib turadi, skeleton
  /// chiqmaydi.
  Future<void> load({bool silent = false}) async {
    if (isClosed) return;
    if (!silent || state is! ReportsLoaded) emit(const ReportsLoading());
    try {
      final result = await _getMyReports(days);
      if (isClosed) return;
      result.fold(
        (failure) => emit(ReportsError(failure.message)),
        (items) => emit(
          items.isEmpty ? const ReportsEmpty() : ReportsLoaded(items),
        ),
      );
    } on Object catch (e) {
      if (!isClosed) emit(ReportsError(unexpectedError(e)));
    }
  }

  /// Hisobotni o'chiradi. `null` — muvaffaqiyat, aks holda ko'rsatiladigan
  /// xato matni (masalan serverning 403 xabari).
  Future<String?> delete(String id) async {
    final current = state;
    if (current is! ReportsLoaded || current.deletingIds.contains(id)) {
      return null;
    }
    emit(current.copyWith(deletingIds: {...current.deletingIds, id}));
    try {
      final result = await _deleteReport(id);
      if (isClosed) return null;
      return result.fold<String?>(
        (failure) {
          final s = state;
          if (s is ReportsLoaded) {
            emit(s.copyWith(deletingIds: {...s.deletingIds}..remove(id)));
          }
          return failure.message;
        },
        (_) {
          final s = state;
          if (s is ReportsLoaded) {
            final items = s.items.where((r) => r.id != id).toList();
            emit(
              items.isEmpty
                  ? const ReportsEmpty()
                  : ReportsLoaded(
                      items,
                      deletingIds: {...s.deletingIds}..remove(id),
                    ),
            );
          }
          return null;
        },
      );
    } on Object catch (e) {
      final s = state;
      if (!isClosed && s is ReportsLoaded) {
        emit(s.copyWith(deletingIds: {...s.deletingIds}..remove(id)));
      }
      return unexpectedError(e);
    }
  }
}
