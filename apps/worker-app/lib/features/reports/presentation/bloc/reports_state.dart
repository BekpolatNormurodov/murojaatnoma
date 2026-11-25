part of 'reports_cubit.dart';

sealed class ReportsState extends Equatable {
  const ReportsState();

  @override
  List<Object?> get props => [];
}

class ReportsLoading extends ReportsState {
  const ReportsLoading();
}

class ReportsLoaded extends ReportsState {
  const ReportsLoaded(this.items, {this.deletingIds = const {}});

  /// Eng yangisi birinchi.
  final List<DailyReport> items;

  /// Hozir o'chirilayotgan hisobotlar.
  final Set<String> deletingIds;

  ReportsLoaded copyWith({
    List<DailyReport>? items,
    Set<String>? deletingIds,
  }) => ReportsLoaded(
    items ?? this.items,
    deletingIds: deletingIds ?? this.deletingIds,
  );

  @override
  List<Object?> get props => [items, deletingIds];
}

class ReportsEmpty extends ReportsState {
  const ReportsEmpty();
}

class ReportsError extends ReportsState {
  const ReportsError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}
