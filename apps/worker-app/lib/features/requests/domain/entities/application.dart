import 'package:equatable/equatable.dart';

/// Fuqaro murojaatining joriy holati.
enum ApplicationStatus { yangi, jarayonda, javobBerildi, yopildi, rad }

/// Murojaatning muhimlik darajasi.
enum ApplicationPriority { past, orta, yuqori }

/// Biriktirilgan fayl turi.
enum AttachmentType { file, image, voice, video }

/// Murojaatga yoki javobga biriktirilgan bitta fayl (hujjat/rasm/ovoz/video).
class AttachmentRef extends Equatable {
  const AttachmentRef({
    required this.type,
    required this.path,
    required this.name,
    this.sizeBytes,
    this.durationMs,
  });

  factory AttachmentRef.fromJson(Map<String, dynamic> json) {
    return AttachmentRef(
      type: AttachmentType.values.byName(json['type'] as String),
      path: json['path'] as String,
      name: json['name'] as String,
      sizeBytes: (json['size_bytes'] as num?)?.toInt(),
      durationMs: (json['duration_ms'] as num?)?.toInt(),
    );
  }

  final AttachmentType type;
  final String path;
  final String name;

  /// Fayl hajmi (baytlarda) — ma'lum bo'lmasa `null`.
  final int? sizeBytes;

  /// Ovozli/video yozuv davomiyligi (millisekundlarda) — faqat
  /// [AttachmentType.voice]/[AttachmentType.video] uchun mazmunli.
  final int? durationMs;

  @override
  List<Object?> get props => [type, path, name, sizeBytes, durationMs];

  Map<String, dynamic> toJson() => {
    'type': type.name,
    'path': path,
    'name': name,
    'size_bytes': sizeBytes,
    'duration_ms': durationMs,
  };
}

/// Xodim tomonidan murojaatga yozilgan javob.
class ApplicationResponse extends Equatable {
  const ApplicationResponse({
    required this.text,
    required this.attachments,
    required this.respondedAt,
  });

  factory ApplicationResponse.fromJson(Map<String, dynamic> json) {
    return ApplicationResponse(
      text: json['text'] as String,
      attachments: (json['attachments'] as List<dynamic>? ?? const [])
          .map((e) => AttachmentRef.fromJson(e as Map<String, dynamic>))
          .toList(),
      respondedAt: json['responded_at'] as String,
    );
  }

  final String text;
  final List<AttachmentRef> attachments;
  final String respondedAt;

  @override
  List<Object?> get props => [text, attachments, respondedAt];

  Map<String, dynamic> toJson() => {
    'text': text,
    'attachments': attachments.map((a) => a.toJson()).toList(),
    'responded_at': respondedAt,
  };
}

/// Fuqaro murojaati (ariza/shikoyat) — xodim ro'yxatda ko'radigan va
/// javob/ball beradigan asosiy domen obyekti.
class Application extends Equatable {
  const Application({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.status,
    required this.priority,
    required this.createdAt,
    required this.assignedToMe,
    required this.points,
    required this.citizenName,
    required this.citizenPhone,
    this.deadline,
    this.attachments = const [],
    this.response,
  });

  factory Application.fromJson(Map<String, dynamic> json) {
    return Application(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      category: json['category'] as String,
      status: ApplicationStatus.values.byName(json['status'] as String),
      priority: ApplicationPriority.values.byName(
        json['priority'] as String,
      ),
      createdAt: json['created_at'] as String,
      deadline: json['deadline'] as String?,
      assignedToMe: json['assigned_to_me'] as bool,
      points: (json['points'] as num).toInt(),
      attachments: (json['attachments'] as List<dynamic>? ?? const [])
          .map((e) => AttachmentRef.fromJson(e as Map<String, dynamic>))
          .toList(),
      response: json['response'] == null
          ? null
          : ApplicationResponse.fromJson(
              json['response'] as Map<String, dynamic>,
            ),
      citizenName: json['citizen_name'] as String,
      citizenPhone: json['citizen_phone'] as String,
    );
  }

  final String id;
  final String title;
  final String description;

  /// Murojaat kategoriyasi (masalan: "Kommunal", "Yo'l", "Hujjat").
  final String category;
  final ApplicationStatus status;
  final ApplicationPriority priority;
  final String createdAt;

  /// Javob berish muddati — belgilanmagan bo'lsa `null`.
  final String? deadline;

  /// `true` bo'lsa — murojaat joriy xodimga biriktirilgan.
  final bool assignedToMe;

  /// Murojaatni yopish/javob berish uchun berilgan/berilajak ball.
  final int points;
  final List<AttachmentRef> attachments;

  /// Xodim javobi — hali javob berilmagan bo'lsa `null`.
  final ApplicationResponse? response;
  final String citizenName;
  final String citizenPhone;

  @override
  List<Object?> get props => [
    id,
    title,
    description,
    category,
    status,
    priority,
    createdAt,
    deadline,
    assignedToMe,
    points,
    attachments,
    response,
    citizenName,
    citizenPhone,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
    'category': category,
    'status': status.name,
    'priority': priority.name,
    'created_at': createdAt,
    'deadline': deadline,
    'assigned_to_me': assignedToMe,
    'points': points,
    'attachments': attachments.map((a) => a.toJson()).toList(),
    'response': response?.toJson(),
    'citizen_name': citizenName,
    'citizen_phone': citizenPhone,
  };
}
