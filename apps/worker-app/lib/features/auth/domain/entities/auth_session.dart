import 'package:equatable/equatable.dart';

/// Ishchining avtorizatsiya sessiyasi.
class AuthSession extends Equatable {
  const AuthSession({
    required this.token,
    required this.workerId,
    required this.name,
    required this.position,
    required this.region,
    this.refreshToken,
    this.phone,
    this.district,
    this.role,
    this.avatarUrl,
    this.hasFace = false,
  });

  final String token;

  /// Backend `employeeId` (JWT `sub`) — `/auth/me`dan olinadi (mock
  /// oqimda demo qiymat). Ilovaning qolgan qismi ("kim kirgan") shu
  /// maydon orqali bilib oladi.
  final String workerId;
  final String name;
  final String position;
  final String region;

  /// Jonli backend `/auth/verify-otp` javobidagi refresh token —
  /// hozircha faqat xavfsiz xotirada saqlanadi (backend kontraktida
  /// hali `/auth/refresh` endpointi yo'q, shuning uchun avtomatik
  /// yangilash oqimi yo'q). Mock oqimda har doim `null`.
  final String? refreshToken;

  /// `/auth/me` javobidagi qo'shimcha profil maydonlari — mock oqimda
  /// (demo sessiya) barchasi `null`/`false` bo'lib qoladi.
  final String? phone;
  final String? district;
  final String? role;
  final String? avatarUrl;

  /// Backendda yuz shabloni allaqachon ro'yxatdan o'tkazilganmi
  /// (`/auth/me.hasFace`) — kelajakda server-tomon holatini mahalliy
  /// (`FaceRepository.getTemplate()`) bilan solishtirish uchun.
  final bool hasFace;

  @override
  List<Object?> get props => [
    token,
    workerId,
    name,
    position,
    region,
    refreshToken,
    phone,
    district,
    role,
    avatarUrl,
    hasFace,
  ];
}
