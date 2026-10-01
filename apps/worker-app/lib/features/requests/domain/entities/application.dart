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

/// Murojaat yozishmasidagi bitta xabar (fuqaro ↔ xodim / hokimiyat).
class ThreadMessage extends Equatable {
  const ThreadMessage({
    required this.fromCitizen,
    required this.text,
    required this.createdAt,
    this.senderName,
    this.attachmentUrl,
  });

  factory ThreadMessage.fromJson(Map<String, dynamic> json) => ThreadMessage(
    fromCitizen: json['from_citizen'] as bool? ?? false,
    text: json['text'] as String? ?? '',
    createdAt: json['created_at'] as String,
    senderName: json['sender_name'] as String?,
    attachmentUrl: json['attachment_url'] as String?,
  );

  final bool fromCitizen;
  final String text;
  final String createdAt;
  final String? senderName;
  final String? attachmentUrl;

  @override
  List<Object?> get props => [
    fromCitizen,
    text,
    createdAt,
    senderName,
    attachmentUrl,
  ];

  Map<String, dynamic> toJson() => {
    'from_citizen': fromCitizen,
    'text': text,
    'created_at': createdAt,
    'sender_name': senderName,
    'attachment_url': attachmentUrl,
  };
}

/// Murojaat tarixidagi bitta hodisa — backend `ApplicationEvent`
/// (`CREATED` / `ASSIGNED` / `STATUS_CHANGED` / `MESSAGE` / `RATED` /
/// `REOPENED`), xodim ismlari bilan.
class ApplicationHistoryEvent extends Equatable {
  const ApplicationHistoryEvent({
    required this.type,
    required this.createdAt,
    this.fromStatus,
    this.toStatus,
    this.note,
    this.actorName,
    this.toEmployeeName,
  });

  factory ApplicationHistoryEvent.fromJson(Map<String, dynamic> json) =>
      ApplicationHistoryEvent(
        type: json['type'] as String? ?? '',
        createdAt: json['created_at'] as String,
        fromStatus: json['from_status'] as String?,
        toStatus: json['to_status'] as String?,
        note: json['note'] as String?,
        actorName: json['actor_name'] as String?,
        toEmployeeName: json['to_employee_name'] as String?,
      );

  final String type;
  final String createdAt;
  final String? fromStatus;
  final String? toStatus;
  final String? note;
  final String? actorName;
  final String? toEmployeeName;

  @override
  List<Object?> get props => [
    type,
    createdAt,
    fromStatus,
    toStatus,
    note,
    actorName,
    toEmployeeName,
  ];

  Map<String, dynamic> toJson() => {
    'type': type,
    'created_at': createdAt,
    'from_status': fromStatus,
    'to_status': toStatus,
    'note': note,
    'actor_name': actorName,
    'to_employee_name': toEmployeeName,
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
    this.isComplaint = false,
    this.address,
    this.latitude,
    this.longitude,
    this.resolvedAt,
    this.rating,
    this.ratingComment,
    this.messages = const [],
    this.history = const [],
  });

  factory Application.fromJson(Map<String, dynamic> json) {
    return Application(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      category: json['category'] as String,
      status: ApplicationStatus.values.byName(json['status'] as String),
      priority: ApplicationPriority.values.byName(json['priority'] as String),
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
      isComplaint: json['is_complaint'] as bool? ?? false,
      address: json['address'] as String?,
      latitude: (json['lat'] as num?)?.toDouble(),
      longitude: (json['lng'] as num?)?.toDouble(),
      resolvedAt: json['resolved_at'] as String?,
      rating: (json['rating'] as num?)?.toInt(),
      ratingComment: json['rating_comment'] as String?,
      messages: (json['messages'] as List<dynamic>? ?? const [])
          .map((e) => ThreadMessage.fromJson(e as Map<String, dynamic>))
          .toList(),
      history: (json['history'] as List<dynamic>? ?? const [])
          .map(
            (e) => ApplicationHistoryEvent.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
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

  /// Fuqaro ilovasida "Shikoyat" sifatida yuborilgan (aks holda ariza).
  final bool isComplaint;

  /// Fuqaro ko'rsatgan manzil / mahalla.
  final String? address;

  /// Fuqaro yuborgan joylashuv (bo'lmasa `null`).
  final double? latitude;
  final double? longitude;
  final String? resolvedAt;

  /// Fuqaro bahosi (1..5) va izohi — hal qilingandan keyin.
  final int? rating;
  final String? ratingComment;

  /// To'liq yozishma (eski → yangi).
  final List<ThreadMessage> messages;

  /// Holatlar tarixi (eski → yangi).
  final List<ApplicationHistoryEvent> history;

  bool get hasLocation => latitude != null && longitude != null;

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
    isComplaint,
    address,
    latitude,
    longitude,
    resolvedAt,
    rating,
    ratingComment,
    messages,
    history,
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
    'is_complaint': isComplaint,
    'address': address,
    'lat': latitude,
    'lng': longitude,
    'resolved_at': resolvedAt,
    'rating': rating,
    'rating_comment': ratingComment,
    'messages': messages.map((m) => m.toJson()).toList(),
    'history': history.map((h) => h.toJson()).toList(),
  };
}
