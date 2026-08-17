/// MOCK — bosh sahifa ("kam data" muammosini hal qilish, Faza 3)
/// dashboardini boyitish uchun vaqtinchalik andoza (demo) ma'lumotlar.
///
/// Haqiqiy backend integratsiyasi (murojaatlar/chat/majlis hisoblagichlari)
/// keyingi bosqichda tegishli feature modullaridan (`RequestsCubit`,
/// `ChatListCubit`, `MeetingsCubit`) o'qiladigan bo'lib almashtiriladi — bu
/// yerda ATAYLAB ularga bog'lanmaydi (boshqa agentlar shu modullar ustida
/// parallel ishlamoqda, shuning uchun bosh sahifa ularning ichki
/// implementatsiyasidan mustaqil bo'lishi kerak).
library;

/// Bosh sahifadagi "Bugungi ko'rinish" (strip) va "Bo'limlar" (tezkor
/// harakatlar to'ri) bo'limlari uchun MOCK sonlar — barchasi bitta joyda,
/// shu tufayli ikkala bo'limda ko'rsatiladigan raqamlar doim bir-biriga
/// mos keladi.
class MockDashboardData {
  const MockDashboardData._();

  /// Bugun biriktirilgan yangi murojaatlar soni (MOCK).
  static const int newRequestsCount = 3;

  /// O'qilmagan chat xabarlari soni (MOCK).
  static const int unreadChatCount = 5;

  /// Bugungi rejalashtirilgan majlislar soni (MOCK).
  static const int meetingsTodayCount = 2;

  /// "So'nggi faoliyat" bo'limi uchun MOCK yozuvlar — eng yangisi birinchi.
  static const List<MockActivityItem> recentActivity = [
    MockActivityItem(kind: MockActivityKind.meeting, time: '15:00'),
    MockActivityItem(kind: MockActivityKind.message, time: '11:40'),
    MockActivityItem(kind: MockActivityKind.request, time: '09:15'),
  ];
}

/// [MockActivityItem]ning turi — sarlavha/icon/rang shu bo'yicha tanlanadi
/// (qarang: `home_page.dart` ichidagi `_ActivityRow`).
enum MockActivityKind { request, message, meeting }

/// "So'nggi faoliyat" ro'yxatidagi bitta (MOCK) yozuv.
class MockActivityItem {
  const MockActivityItem({required this.kind, required this.time});

  final MockActivityKind kind;

  /// Ko'rsatish uchun tayyor vaqt matni (masalan '09:15') — MOCK, shuning
  /// uchun ataylab doim bugungi kun ichidagi (soat:daqiqa) qiymat, alohida
  /// tarjima/formatlash talab qilmaydi.
  final String time;
}
