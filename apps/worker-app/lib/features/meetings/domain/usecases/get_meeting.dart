import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/domain/repositories/meetings_repository.dart';

/// Bitta majlisni ID bo'yicha olish (tafsilotlar sahifasi uchun).
class GetMeeting implements UseCase<Meeting, GetMeetingParams> {
  GetMeeting(this.repository);

  final MeetingsRepository repository;

  @override
  Future<Either<Failure, Meeting>> call(GetMeetingParams params) {
    return repository.getById(params.id);
  }
}

/// [GetMeeting] uchun kirish parametri.
class GetMeetingParams extends Equatable {
  const GetMeetingParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
