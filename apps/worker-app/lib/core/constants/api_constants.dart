/// API endpointlar va tarmoq konstantalari.
class ApiConstants {
  ApiConstants._();

  static const String baseUrl = 'https://api.hokimiyat.uz/v1';
  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 20);

  // Auth
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify';

  // Profile
  static const String profile = '/profile';

  // Payments
  static const String utilities = '/payments/utilities';
  static const String cards = '/payments/cards';
  static const String pay = '/payments/pay';

  // Requests
  static const String requests = '/requests';
}
