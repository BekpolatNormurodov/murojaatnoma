import 'package:equatable/equatable.dart';

/// Bitta murojaat (ariza/shikoyat) mavzusidagi xabar muallifi.
///
/// Backenddagi `MessageSenderRole` (`CITIZEN`/`EMPLOYEE`/`SYSTEM`) bilan
/// bir xil uchta qiymat — fuqaro o'zi yozgan xabarlar, xodim javoblari va
/// tizim (avtomatik) xabarlari.
enum RequestMessageSenderRole { citizen, employee, system }

RequestMessageSenderRole _parseSenderRole(String? raw) => switch (raw) {
  'CITIZEN' => RequestMessageSenderRole.citizen,
  'EMPLOYEE' => RequestMessageSenderRole.employee,
  'SYSTEM' => RequestMessageSenderRole.system,
  // Noma'lum/bo'sh qiymat — tizim xabari deb hisoblanadi (chapga
  // tekislanadi, "Siz" sifatida ko'rsatilmaydi) — hech qachon qulamaydi.
  _ => RequestMessageSenderRole.system,
};

String _senderRoleToJson(RequestMessageSenderRole role) => switch (role) {
  RequestMessageSenderRole.citizen => 'CITIZEN',
  RequestMessageSenderRole.employee => 'EMPLOYEE',
  RequestMessageSenderRole.system => 'SYSTEM',
};

/// Murojaat tafsilotlari sahifasidagi suhbat (thread)ning bitta xabari —
/// fuqaro yozgan savol yoki xodim/tizim javobi.
///
/// `GET/POST /applications/:id/messages`ning to'g'ridan-to'g'ri aks
/// ettirilishi (qarang: `CitizenRequestsApiImpl`) — mock rejimda esa
/// `mock_citizen_requests.dart`dagi xotiradagi ro'yxat bilan ishlaydi.
class RequestMessage extends Equatable {
  const RequestMessage({
    required this.id,
    required this.senderRole,
    required this.text,
    required this.createdAt,
    this.senderName,
    this.attachmentUrl,
  });

  /// Har bir maydon — server javobi kutilmagan shaklda bo'lsa ham (masalan
  /// `null`/boshqa turdagi qiymat) — xavfsiz standart qiymatga tushadi,
  /// hech qachon `TypeError` bilan qulamaydi.
  factory RequestMessage.fromJson(Map<String, dynamic> json) {
    return RequestMessage(
      id: json['id'] as String? ?? '',
      senderRole: _parseSenderRole(json['senderRole'] as String?),
      senderName: json['senderName'] as String?,
      text: json['text'] as String? ?? '',
      attachmentUrl: json['attachmentUrl'] as String?,
      createdAt:
          json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  final String id;
  final RequestMessageSenderRole senderRole;

  /// Xabar muallifining ismi — bo'lmasligi mumkin (masalan tizim xabari).
  final String? senderName;
  final String text;

  /// Biriktirilgan fayl/rasm havolasi — bo'lsa.
  final String? attachmentUrl;

  /// Yuborilgan vaqt (ISO satr).
  final String createdAt;

  @override
  List<Object?> get props => [
    id,
    senderRole,
    senderName,
    text,
    attachmentUrl,
    createdAt,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'senderRole': _senderRoleToJson(senderRole),
    'senderName': senderName,
    'text': text,
    'attachmentUrl': attachmentUrl,
    'createdAt': createdAt,
  };
}
