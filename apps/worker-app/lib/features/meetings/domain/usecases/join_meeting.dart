import 'package:app_core/app_core.dart';
import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:worker_app/features/meetings/domain/entities/meeting.dart';
import 'package:worker_app/features/meetings/domain/repositories/meetings_repository.dart';

/// Majlisga qo'shilish (join URL bilan yangilangan majlisni qaytaradi).
class JoinMeeting implements UseCase<Meeting, JoinMeetingParams> {
  JoinMeeting(this.repository);

  final MeetingsRepository repository;

  @override
  Future<Either<Failure, Meeting>> call(JoinMeetingParams params) {
    return repository.join(params.id);
  }
}

/// [JoinMeeting] uchun kirish parametri.
class JoinMeetingParams extends Equatable {
  const JoinMeetingParams(this.id);

  final String id;

  @override
  List<Object?> get props => [id];
}
