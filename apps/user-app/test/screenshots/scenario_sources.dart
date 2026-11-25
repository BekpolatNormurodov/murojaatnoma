// Fake data sources for the screenshot tool: one switch per screen state.
// ignore_for_file: lines_longer_than_80_chars
import 'dart:async';

import 'package:app_core/app_core.dart';
import 'package:mocktail/mocktail.dart';
import 'package:user_app/features/face/presentation/bloc/face_cubit.dart';
import 'package:user_app/features/news/data/datasources/news_remote_data_source.dart';
import 'package:user_app/features/news/domain/entities/news_item.dart';
import 'package:user_app/features/notifications/data/datasources/notifications_mock_data_source.dart';
import 'package:user_app/features/notifications/domain/entities/notification_item.dart';
import 'package:user_app/features/payments/data/datasources/payments_remote_data_source.dart';
import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';
import 'package:user_app/features/requests/data/datasources/citizen_requests_remote_data_source.dart';
import 'package:user_app/features/requests/domain/entities/citizen_request.dart';
import 'package:user_app/features/requests/domain/entities/request_message.dart';
import 'package:user_app/injection.dart';

enum Mode { loading, empty, error, filled }

const _offline =
    "Internetga ulanib bo'lmadi. Aloqani tekshirib, qayta urining.";

Future<T> _answer<T>(Mode mode, T empty, T filled) => switch (mode) {
  Mode.loading => Completer<T>().future,
  Mode.error => Future<T>.error(ServerException(_offline)),
  Mode.empty => Future.value(empty),
  Mode.filled => Future.value(filled),
};

void stubFaceCubit(FaceCubit cubit) {
  when(cubit.close).thenAnswer((_) async {});
  when(cubit.startCamera).thenAnswer((_) async {});
  when(cubit.pauseCamera).thenAnswer((_) async {});
  when(cubit.resumeCamera).thenAnswer((_) async {});
}

const demoUtility = Utility(
  id: 'u4',
  type: UtilityType.issiqlik,
  provider: "Toshkent issiqlik ta'minoti korxonasi",
  accountNumber: '2290 8713 45',
  balanceDue: 1320000,
  lastInvoiceAt: '2026-11-01',
);

const _utilities = [
  Utility(
    id: 'u1',
    type: UtilityType.elektr,
    provider: 'Toshkent Elektr Tarmoqlari',
    accountNumber: '3021 4567 89',
    balanceDue: 145000,
    lastInvoiceAt: '2026-11-01',
  ),
  Utility(
    id: 'u2',
    type: UtilityType.gaz,
    provider: "Hududgazta'minot",
    accountNumber: '5512 3788 90',
    balanceDue: 89000,
    lastInvoiceAt: '2026-11-01',
  ),
  Utility(
    id: 'u3',
    type: UtilityType.suv,
    provider: "Toshkent Suv Ta'minoti",
    accountNumber: '7743 0921 56',
    balanceDue: 0,
    lastInvoiceAt: '2026-11-05',
  ),
  demoUtility,
  Utility(
    id: 'u5',
    type: UtilityType.chiqindi,
    provider: 'Toza Hudud',
    accountNumber: '1180 4402 17',
    balanceDue: 18500,
    lastInvoiceAt: '2026-11-03',
  ),
];

final demoPayment = Payment(
  id: 'PAY-1764064800000',
  type: UtilityType.issiqlik,
  amount: 1320000,
  paidAt: '2026-11-24T18:42:00',
  status: PaymentStatus.success,
  cardLast4: '4412',
);

final _payments = [
  demoPayment,
  Payment(
    id: 'PAY-2',
    type: UtilityType.elektr,
    amount: 45000,
    paidAt: '2026-11-20T09:05:00',
    status: PaymentStatus.failed,
    cardLast4: '1198',
  ),
  Payment(
    id: 'PAY-3',
    type: UtilityType.suv,
    amount: 18500,
    paidAt: '2026-10-11T21:30:00',
    status: PaymentStatus.pending,
    cardLast4: '4412',
  ),
  Payment(
    id: 'PAY-4',
    type: UtilityType.gaz,
    amount: 230000,
    paidAt: '2026-09-02T12:00:00',
    status: PaymentStatus.success,
    cardLast4: '4412',
  ),
];

class _Payments implements PaymentsRemoteDataSource {
  _Payments(this.mode);
  final Mode mode;
  @override
  Future<List<Utility>> utilities() => _answer(mode, const [], _utilities);
  @override
  Future<List<Payment>> history() => _answer(mode, const [], _payments);
  @override
  Future<Payment> pay({
    required UtilityType type,
    required double amount,
    required String cardNumber,
  }) async => demoPayment;
}

const _history = [
  RequestHistoryEvent(type: 'CREATED', createdAt: '2026-11-18T04:12:00Z'),
  RequestHistoryEvent(
    type: 'ASSIGNED',
    createdAt: '2026-11-18T06:30:00Z',
    employeeName: 'Abdurahmonov Sherzod Ulug‘bekovich',
  ),
  RequestHistoryEvent(
    type: 'STATUS_CHANGED',
    createdAt: '2026-11-19T03:00:00Z',
    toStatus: 'IN_PROGRESS',
  ),
];

const _attachments = [
  RequestAttachment(
    type: RequestAttachmentType.image,
    path: 'https://example.invalid/a.jpg',
    name: 'IMG_20261118_091500_kocha_chuquri_old_tomondan.jpg',
    sizeBytes: 345000,
  ),
  RequestAttachment(
    type: RequestAttachmentType.voice,
    path: 'https://example.invalid/b.m4a',
    name: 'ovozli-xabar.m4a',
    sizeBytes: 88000,
  ),
  RequestAttachment(
    type: RequestAttachmentType.video,
    path: 'https://example.invalid/c.mp4',
    name: 'video.mp4',
    sizeBytes: 4300000,
  ),
];

CitizenRequest _request(
  String id,
  RequestStatus status, {
  RequestKind kind = RequestKind.shikoyat,
}) => CitizenRequest(
  id: id,
  kind: kind,
  category: kind == RequestKind.shikoyat
      ? "Yo'l xo'jaligi va obodonlashtirish"
      : "Ma'lumotnoma",
  title: "Mahalla ko'chasida katta chuqur bor, mashinalar zarar ko'rmoqda",
  body:
      "Bizning ko'chamizda (Bog'bon ko'chasi, 14-uy oldida) asfaltda katta chuqur paydo bo'lgan, mashinalar zarar ko'rmoqda. Tuzatishni so'rayman.",
  status: status,
  createdAt: '2026-11-18T04:12:00Z',
  region: 'Toshkent shahri',
  district: "Mirzo Ulug'bek tumani",
  address: "Bog'bon ko'chasi, 14-uy",
  dueAt: status == RequestStatus.yuborilgan ? null : '2026-11-28T13:00:00Z',
  resolvedAt: status == RequestStatus.javobBerildi
      ? '2026-11-22T10:20:00Z'
      : null,
  history: switch (status) {
    RequestStatus.yuborilgan => [_history.first],
    RequestStatus.korilmoqda => _history,
    RequestStatus.javobBerildi => [
      ..._history,
      const RequestHistoryEvent(
        type: 'STATUS_CHANGED',
        createdAt: '2026-11-22T10:20:00Z',
        toStatus: 'RESOLVED',
        note: "Chuqur asfalt bilan to'ldirildi.",
      ),
    ],
    RequestStatus.yopildi => [
      ..._history,
      const RequestHistoryEvent(
        type: 'STATUS_CHANGED',
        createdAt: '2026-11-21T10:20:00Z',
        toStatus: 'REJECTED',
        note: "Ushbu ko'cha xususiy hududga tegishli, hokimlik ta'mirlamaydi.",
      ),
    ],
  },
  attachments: status == RequestStatus.yuborilgan ? const [] : _attachments,
);

final _requests = [
  _request('new', RequestStatus.yuborilgan),
  _request('open', RequestStatus.korilmoqda),
  _request('resolved', RequestStatus.javobBerildi),
  _request('rejected', RequestStatus.yopildi),
  _request('ariza', RequestStatus.yuborilgan, kind: RequestKind.ariza),
  _request('ariza2', RequestStatus.javobBerildi, kind: RequestKind.ariza),
];

class _Requests extends CitizenRequestsRemoteDataSourceMockImpl {
  _Requests(this.mode);
  final Mode mode;
  @override
  Future<List<CitizenRequest>> list({
    RequestKind? kind,
    RequestStatus? status,
    String? query,
  }) => _answer(mode, const [], [
    for (final r in _requests)
      if ((kind == null || r.kind == kind) &&
          (status == null || r.status == status))
        r,
  ]);
  @override
  Future<CitizenRequest> getById(String id) =>
      _answer(mode, _requests.first, _requests.firstWhere((r) => r.id == id));
  @override
  Future<List<RequestMessage>> getMessages(
    String requestId,
  ) => _answer(mode, const [], [
    if (requestId != 'new') ...const [
      RequestMessage(
        id: 'm1',
        senderRole: RequestMessageSenderRole.system,
        text: 'Murojaatingiz qabul qilindi.',
        createdAt: '2026-11-18T04:12:00Z',
      ),
      RequestMessage(
        id: 'm2',
        senderRole: RequestMessageSenderRole.employee,
        senderName: 'Abdurahmonov Sherzod Ulug‘bekovich',
        text:
            "Assalomu alaykum. Murojaatingiz bo'yicha mutaxassis ertaga joyiga chiqadi.",
        createdAt: '2026-11-18T07:00:00Z',
      ),
      RequestMessage(
        id: 'm3',
        senderRole: RequestMessageSenderRole.citizen,
        senderName: 'Aliyeva Nodira',
        text: 'Rahmat, kutamiz.',
        createdAt: '2026-11-18T07:05:00Z',
      ),
    ],
  ]);
}

class _Notifications implements NotificationsDataSource {
  _Notifications(this.mode);
  final Mode mode;
  @override
  Future<List<NotificationItem>> fetch() async {
    final all = mode == Mode.filled
        ? await NotificationsMockDataSource().fetch()
        : <NotificationItem>[];
    return _answer(mode, const [], all);
  }

  @override
  Future<void> markRead(String id) async {}
  @override
  Future<void> markAllRead() async {}
}

final demoNews = [
  NewsItem(
    id: 'n1',
    title: "Tumanda yangi 12 ta zamonaviy kamera o'rnatildi",
    excerpt:
        "Jamoat xavfsizligini ta'minlash maqsadida markaziy ko'chalarda yangi videokuzatuv tizimi ishga tushirildi.",
    body:
        "Jamoat xavfsizligini ta'minlash maqsadida markaziy ko'chalarda yangi videokuzatuv tizimi ishga tushirildi.\n\nTuman hokimiyati matbuot xizmati qo'shimcha ma'lumotlarni rasmiy kanallar orqali e'lon qiladi.",
    category: 'ogohlantirish',
    status: 'published',
    cover: 'https://example.invalid/1.jpg',
    author: 'Matbuot xizmati',
    publishedAt: '2026-10-02T05:30:00.000Z',
    views: 120,
    featured: true,
  ),
  const NewsItem(
    id: 'n2',
    title: 'Issiqlik mavsumiga tayyorgarlik yakunlandi',
    excerpt: "Ko'p qavatli uylarning issiqlik tizimlari sinovdan o'tkazildi.",
    body: 'Matn',
    category: 'elon',
    status: 'published',
    cover: '',
    author: 'Hokim apparati',
    publishedAt: '2026-09-28T05:30:00.000Z',
    views: 80,
    featured: false,
  ),
];

class _News implements NewsRemoteDataSource {
  _News(this.mode);
  final Mode mode;
  @override
  Future<List<NewsItem>> list() => _answer(mode, const [], demoNews);
}

void useScenarioSources(Mode mode) {
  void swap<T extends Object>(T source) {
    getIt
      ..unregister<T>()
      ..registerSingleton<T>(source);
  }

  swap<PaymentsRemoteDataSource>(_Payments(mode));
  swap<CitizenRequestsRemoteDataSource>(_Requests(mode));
  swap<NotificationsDataSource>(_Notifications(mode));
  swap<NewsRemoteDataSource>(_News(mode));
}
