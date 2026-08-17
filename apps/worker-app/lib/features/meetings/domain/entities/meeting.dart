import 'package:equatable/equatable.dart';

/// Majlisning joriy holati.
enum MeetingStatus { rejalashtirilgan, jonli, tugagan }

/// Bitta majlis (yig'ilish) — ro'yxatda va tafsilotlar sahifasida
/// ko'rsatiladigan asosiy domen obyekti.
class Meeting extends Equatable {
  const Meeting({
    required this.id,
    required this.title,
    required this.startAt,
    required this.durationMin,
    required this.host,
    required this.participants,
    required this.status,
    this.description,
    this.joinUrl,
  });

  factory Meeting.fromJson(Map<String, dynamic> json) {
    return Meeting(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      startAt: json['start_at'] as String,
      durationMin: (json['duration_min'] as num).toInt(),
      host: json['host'] as String,
      participants: (json['participants'] as List<dynamic>? ?? const [])
          .map((e) => e as String)
          .toList(),
      status: MeetingStatus.values.byName(json['status'] as String),
      joinUrl: json['join_url'] as String?,
    );
  }

  final String id;
  final String title;

  /// Majlis tavsifi/kun tartibi — bo'lmasa `null`.
  final String? description;

  /// Boshlanish vaqti (ISO-8601).
  final String startAt;

  /// Davomiyligi (daqiqalarda).
  final int durationMin;

  /// Majlisni boshqaruvchi (tashkilotchi) xodim.
  final String host;

  /// Ishtirokchilar ro'yxati (ism-familiya).
  final List<String> participants;
  final MeetingStatus status;

  /// Video-qo'shilish havolasi — hali berilmagan/tugagan bo'lsa `null`.
  final String? joinUrl;

  @override
  List<Object?> get props => [
    id,
    title,
    description,
    startAt,
    durationMin,
    host,
    participants,
    status,
    joinUrl,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
    'start_at': startAt,
    'duration_min': durationMin,
    'host': host,
    'participants': participants,
    'status': status.name,
    'join_url': joinUrl,
  };
}
