import 'package:app_core/app_core.dart';

/// Chatdagi odamning ochiq profil kartasi — `GET /chat/my/people/:id`:
/// ism, lavozim, bo'lim, rasm (telefon/maosh/joylashuv YO'Q).
class ChatPersonCard {
  const ChatPersonCard({
    required this.id,
    required this.fullName,
    required this.isEmployee,
    this.position,
    this.department,
    this.avatarUrl,
  });

  factory ChatPersonCard.fromJson(Map<String, dynamic> json) => ChatPersonCard(
    id: json['id'] as String? ?? '',
    fullName: json['fullName'] as String? ?? '',
    position: json['position'] as String?,
    department: json['department'] as String?,
    avatarUrl: _absolute(json['avatarUrl'] as String?),
    isEmployee: json['isEmployee'] as bool? ?? true,
  );

  final String id;
  final String fullName;
  final String? position;
  final String? department;
  final String? avatarUrl;
  final bool isEmployee;
}

// Seam: testlarda soxta manba bilan almashtiriladi.
// ignore: one_member_abstracts
abstract class ChatPeople {
  /// Topilmasa / xato bo'lsa `null` — varaq baribir chatdagi ism bilan ochiladi.
  Future<ChatPersonCard?> card(String id);
}

class ApiChatPeople implements ChatPeople {
  ApiChatPeople(this._client);

  final DioClient _client;
  final _cache = <String, ChatPersonCard>{};

  @override
  Future<ChatPersonCard?> card(String id) async {
    final hit = _cache[id];
    if (hit != null) return hit;
    try {
      final res = await _client.dio.get<Map<String, dynamic>>(
        '/chat/my/people/${Uri.encodeComponent(id)}',
      );
      final data = res.data;
      if (data == null) return null;
      return _cache[id] = ChatPersonCard.fromJson(data);
    } on Object {
      return null;
    }
  }
}

/// `/uploads/x.jpg` → `https://murojaatnoma.uz/uploads/x.jpg`.
String? _absolute(String? path) {
  if (path == null || path.trim().isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  final uri = Uri.parse(AppConfig.apiBaseUrl);
  final port = uri.hasPort ? ':${uri.port}' : '';
  final origin = '${uri.scheme}://${uri.host}$port';
  return path.startsWith('/') ? '$origin$path' : '$origin/$path';
}
