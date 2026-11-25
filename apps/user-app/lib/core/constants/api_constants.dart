/// Jonli MUROJAAT backendi. Auth, murojaatlar, yangiliklar va
/// bildirishnomalar doim haqiqiy serverga ulanadi, shuning uchun HAR BIR
/// entrypoint shu manzilni berishi shart. Boshqa manzil kerak bo'lsa:
/// `--dart-define=API_BASE_URL=...`.
const kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://murojaatnoma.uz/api',
);
