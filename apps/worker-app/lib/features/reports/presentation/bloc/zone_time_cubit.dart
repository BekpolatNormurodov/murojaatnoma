import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:worker_app/features/reports/domain/entities/zone_time.dart';
import 'package:worker_app/features/reports/domain/usecases/get_zone_time.dart';
import 'package:worker_app/core/utils/error_text.dart';

/// "Hududda bo'lgan vaqt" — bugun va oldingi 7 kun (hisobot yozish mumkin
/// bo'lgan kunlar bilan bir xil). Hech qachon throw qilmaydi.
class ZoneTimeCubit extends Cubit<ZoneTimeState> {
  ZoneTimeCubit({required GetZoneTime getZoneTime, this.days = 8})
    : _getZoneTime = getZoneTime,
      super(const ZoneTimeLoading());

  final GetZoneTime _getZoneTime;
  final int days;

  Future<void> load({bool silent = false}) async {
    if (isClosed) return;
    if (!silent || state is! ZoneTimeLoaded) emit(const ZoneTimeLoading());
    try {
      final result = await _getZoneTime(days);
      if (isClosed) return;
      result.fold(
        (failure) => emit(ZoneTimeError(failure.message)),
        (report) => emit(ZoneTimeLoaded(report)),
      );
    } on Object catch (e) {
      if (!isClosed) emit(ZoneTimeError(unexpectedError(e)));
    }
  }
}

sealed class ZoneTimeState extends Equatable {
  const ZoneTimeState();

  @override
  List<Object?> get props => [];
}

class ZoneTimeLoading extends ZoneTimeState {
  const ZoneTimeLoading();
}

class ZoneTimeLoaded extends ZoneTimeState {
  const ZoneTimeLoaded(this.report);

  final ZoneTimeReport report;

  @override
  List<Object?> get props => [report];
}

class ZoneTimeError extends ZoneTimeState {
  const ZoneTimeError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
