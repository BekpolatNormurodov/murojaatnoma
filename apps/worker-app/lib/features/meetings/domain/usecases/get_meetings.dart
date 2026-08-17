import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/domain/repositories/meetings_repository.dart';

/// Majlislar ro'yxatini (ixtiyoriy holat filtri bilan) olish.
class GetMeetings implements UseCase<List<Meeting>, GetMeetingsParams> {
  GetMeetings(this.repository);

  final MeetingsRepository repository;

  @override
  Future<Either<Failure, List<Meeting>>> call(GetMeetingsParams params) {
    return repository.list(status: params.status);
  }
}

/// [GetMeetings] uchun filtr parametri.
class GetMeetingsParams extends Equatable {
  const GetMeetingsParams({this.status});

  final MeetingStatus? status;

  @override
  List<Object?> get props => [status];
}
