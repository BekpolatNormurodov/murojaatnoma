import 'package:equatable/equatable.dart';

/// Fuqaro murojaatining turi.
enum RequestKind { ariza, shikoyat }

/// Fuqaro murojaatining joriy holati.
enum RequestStatus { yuborilgan, korilmoqda, javobBerildi, yopildi }

/// Murojaatga biriktirilgan fayl turi.
enum RequestAttachmentType { file, image, voice, video }

/// Murojaatga biriktirilgan bitta fayl (hujjat/rasm/ovoz/video).
class RequestAttachment extends Equatable {
  const RequestAttachment({
    required this.type,
    required this.path,
    required this.name,
    this.sizeBytes,
    this.durationMs,
  });

  /// `size_bytes`/`duration_ms` JSON'da int yoki double kelishi mumkin —
  /// shuning uchun `num` orqali xavfsiz (int-safe) o'qiladi.
  factory RequestAttachment.fromJson(Map<String, dynamic> json) {
    return RequestAttachment(
      type: RequestAttachmentType.values.byName(json['type'] as String),
      path: json['path'] as String,
      name: json['name'] as String,
      sizeBytes: (json['size_bytes'] as num?)?.toInt(),
      durationMs: (json['duration_ms'] as num?)?.toInt(),
    );
  }

  final RequestAttachmentType type;
  final String path;
  final String name;

  /// Fayl hajmi (baytlarda) — ma'lum bo'lmasa `null`.
  final int? sizeBytes;

  /// Ovozli xabar davomiyligi (millisekundlarda) — faqat
  /// [RequestAttachmentType.voice] uchun mazmunli.
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

/// Davlat idorasi (xodim) tomonidan murojaatga yozilgan rasmiy javob.
class CitizenRequestResponse extends Equatable {
  const CitizenRequestResponse({required this.text, required this.respondedAt});

  factory CitizenRequestResponse.fromJson(Map<String, dynamic> json) {
    return CitizenRequestResponse(
      text: json['text'] as String,
      respondedAt: json['responded_at'] as String,
    );
  }

  final String text;

  /// Javob berilgan vaqt (ISO `yyyy-MM-ddTHH:mm:ss`).
  final String respondedAt;

  @override
  List<Object?> get props => [text, respondedAt];

  Map<String, dynamic> toJson() => {'text': text, 'responded_at': respondedAt};
}

/// Fuqaro tomonidan yuborilgan bitta ariza yoki shikoyat.
///
/// Ikkala turni ([RequestKind.ariza]/[RequestKind.shikoyat]) BITTA entity
/// qamrab oladi — [kind] ular orasida farqlaydi (ma'lumot shakli bir xil;
/// UI'da segmentlangan tab bilan ajratiladi).
class CitizenRequest extends Equatable {
  const CitizenRequest({
    required this.id,
    required this.kind,
    required this.category,
    required this.title,
    required this.body,
    required this.status,
    required this.createdAt,
    this.response,
    this.attachments = const [],
  });

  factory CitizenRequest.fromJson(Map<String, dynamic> json) {
    return CitizenRequest(
      id: json['id'] as String,
      kind: RequestKind.values.byName(json['kind'] as String),
      category: json['category'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      status: RequestStatus.values.byName(json['status'] as String),
      createdAt: json['created_at'] as String,
      response: json['response'] == null
          ? null
          : CitizenRequestResponse.fromJson(
              json['response'] as Map<String, dynamic>,
            ),
      attachments: (json['attachments'] as List<dynamic>? ?? const [])
          .map((e) => RequestAttachment.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  final String id;
  final RequestKind kind;

  /// Murojaat kategoriyasi (masalan: "Kommunal xizmat", "Yo'l xo'jaligi").
  final String category;
  final String title;
  final String body;
  final RequestStatus status;

  /// Yuborilgan vaqt (ISO `yyyy-MM-ddTHH:mm:ss`).
  final String createdAt;

  /// Rasmiy javob — hali javob berilmagan bo'lsa `null`.
  final CitizenRequestResponse? response;
  final List<RequestAttachment> attachments;

  @override
  List<Object?> get props => [
    id,
    kind,
    category,
    title,
    body,
    status,
    createdAt,
    response,
    attachments,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind.name,
    'category': category,
    'title': title,
    'body': body,
    'status': status.name,
    'created_at': createdAt,
    'response': response?.toJson(),
    'attachments': attachments.map((a) => a.toJson()).toList(),
  };
}
