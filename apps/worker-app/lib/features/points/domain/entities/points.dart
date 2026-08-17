import 'package:equatable/equatable.dart';

/// Ball tarixidagi bitta yozuv — ball qo'shilishi yoki ayirilishi sababi
/// bilan birga.
class PointsEntry extends Equatable {
  const PointsEntry({
    required this.id,
    required this.reason,
    required this.delta,
    required this.at,
    required this.positive,
  });

  factory PointsEntry.fromJson(Map<String, dynamic> json) {
    return PointsEntry(
      id: json['id'] as String,
      reason: json['reason'] as String,
      delta: (json['delta'] as num).toInt(),
      at: json['at'] as String,
      positive: json['positive'] as bool,
    );
  }

  final String id;

  /// Ball o'zgarishi sababi (masalan: "Ariza o'z vaqtida bajarildi").
  final String reason;

  /// Ball o'zgarishi miqdori — ijobiy yoki manfiy son.
  final int delta;

  /// Yozuv sanasi/vaqti (ISO-8601).
  final String at;

  /// `true` bo'lsa — ijobiy (ball qo'shilgan) yozuv.
  final bool positive;

  @override
  List<Object?> get props => [id, reason, delta, at, positive];

  Map<String, dynamic> toJson() => {
    'id': id,
    'reason': reason,
    'delta': delta,
    'at': at,
    'positive': positive,
  };
}

/// Xodimning joriy ball nazorati holati — umumiy ball, reyting o'rni
/// (ma'lum bo'lsa) va o'zgarishlar tarixi.
class WorkerPoints extends Equatable {
  const WorkerPoints({required this.total, required this.history, this.rank});

  factory WorkerPoints.fromJson(Map<String, dynamic> json) {
    return WorkerPoints(
      total: (json['total'] as num).toInt(),
      rank: (json['rank'] as num?)?.toInt(),
      history: (json['history'] as List<dynamic>? ?? const [])
          .map((e) => PointsEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Joriy umumiy ball.
  final int total;

  /// Xodimlar orasidagi reyting o'rni — ma'lum bo'lmasa `null`.
  final int? rank;
  final List<PointsEntry> history;

  @override
  List<Object?> get props => [total, rank, history];

  Map<String, dynamic> toJson() => {
    'total': total,
    'rank': rank,
    'history': history.map((h) => h.toJson()).toList(),
  };
}
