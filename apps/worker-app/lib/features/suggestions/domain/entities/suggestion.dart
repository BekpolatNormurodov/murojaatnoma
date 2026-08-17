import 'package:equatable/equatable.dart';

/// Taklifning ko'rib chiqilish holati.
enum SuggestionStatus { yangi, korilmoqda, qabulQilindi, rad }

/// Xodim tomonidan yuborilgan bitta taklif (ratsionalizatorlik g'oyasi) —
/// ro'yxatda ko'rsatiladigan va ovoz berish mumkin bo'lgan domen obyekti.
class Suggestion extends Equatable {
  const Suggestion({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    required this.status,
    required this.createdAt,
    required this.votes,
  });

  factory Suggestion.fromJson(Map<String, dynamic> json) {
    return Suggestion(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      category: json['category'] as String,
      status: SuggestionStatus.values.byName(json['status'] as String),
      createdAt: json['created_at'] as String,
      votes: (json['votes'] as num).toInt(),
    );
  }

  final String id;
  final String title;

  /// Taklifning to'liq matni.
  final String body;

  /// Taklif yo'nalishi (masalan: "Ish jarayoni", "Raqamlashtirish").
  final String category;
  final SuggestionStatus status;
  final String createdAt;

  /// Hamkasblar tomonidan berilgan ovozlar soni.
  final int votes;

  @override
  List<Object?> get props => [
    id,
    title,
    body,
    category,
    status,
    createdAt,
    votes,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'body': body,
    'category': category,
    'status': status.name,
    'created_at': createdAt,
    'votes': votes,
  };
}
