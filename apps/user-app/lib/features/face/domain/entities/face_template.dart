import 'package:equatable/equatable.dart';

/// Fuqaroning xavfsiz saqlangan yuz shabloni (identity enrollment).
///
/// `worker_app`dagi `FaceTemplate` bilan bir xil shakl — faqat `workerId`
/// o'rniga `ownerId` (fuqaro sessiyasining `AuthSession.userId`i).
class FaceTemplate extends Equatable {
  const FaceTemplate({
    required this.embedding,
    required this.enrolledAt,
    required this.ownerId,
  });

  factory FaceTemplate.fromJson(Map<String, dynamic> json) {
    return FaceTemplate(
      embedding: (json['embedding'] as List)
          .map((e) => (e as num).toDouble())
          .toList(),
      enrolledAt: DateTime.parse(json['enrolled_at'] as String),
      ownerId: json['owner_id'] as String,
    );
  }

  final List<double> embedding;
  final DateTime enrolledAt;
  final String ownerId;

  @override
  List<Object?> get props => [embedding, enrolledAt, ownerId];

  Map<String, dynamic> toJson() => {
    'embedding': embedding,
    'enrolled_at': enrolledAt.toIso8601String(),
    'owner_id': ownerId,
  };
}
