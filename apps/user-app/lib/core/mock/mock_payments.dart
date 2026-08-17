import 'package:user_app/features/payments/domain/entities/payment.dart';
import 'package:user_app/features/payments/domain/entities/saved_card.dart';
import 'package:user_app/features/payments/domain/entities/utility.dart';

/// Kommunal xizmatlar (kommunalka) uchun xotiradagi soxta (mock) "backend"
/// holati.
///
/// `PaymentsRemoteDataSourceMockImpl` shu ro'yxatni o'qiydi/yozadi —
/// `AppConfig.useMock` `true` bo'lganda haqiqiy backend o'rnini bosadi.
/// `mock_applications.dart`dagi uslubga o'xshash: modul darajasidagi,
/// mutable (`final` bog'lovchi, o'zgaruvchan ro'yxat) — ilova ishlab
/// turgan davrda xotirada saqlanadi, restart'da boshlang'ich holatga
/// qaytadi.
final List<Utility> mockUtilities = [
  const Utility(
    id: 'UTL-ELEKTR-1',
    type: UtilityType.elektr,
    provider: 'Toshkent Elektr Tarmoqlari',
    accountNumber: '3021 4567 89',
    balanceDue: 145000,
    lastInvoiceAt: '2026-07-01',
  ),
  const Utility(
    id: 'UTL-GAZ-1',
    type: UtilityType.gaz,
    provider: 'Toshkentgaz',
    accountNumber: '5512 3788 90',
    balanceDue: 89000,
    lastInvoiceAt: '2026-07-01',
  ),
  const Utility(
    id: 'UTL-SUV-1',
    type: UtilityType.suv,
    provider: "Toshkent Suv Ta'minoti",
    accountNumber: '7743 0921 56',
    balanceDue: 0,
    lastInvoiceAt: '2026-07-05',
  ),
  const Utility(
    id: 'UTL-ISSIQLIK-1',
    type: UtilityType.issiqlik,
    provider: 'Issiqlik Manbai',
    accountNumber: '2290 8713 45',
    balanceDue: 320000,
    lastInvoiceAt: '2026-06-28',
  ),
  const Utility(
    id: 'UTL-CHIQINDI-1',
    type: UtilityType.chiqindi,
    provider: 'Toza Hudud',
    accountNumber: '1145 5622 03',
    balanceDue: 25000,
    lastInvoiceAt: '2026-07-10',
  ),
];

/// To'lovlar tarixi uchun xotiradagi soxta (mock) "backend" holati — eng
/// yangisi birinchi tartibda. `pay()` muvaffaqiyatli chaqiruvi yangi
/// yozuvni ro'yxat BOSHIGA qo'shadi.
final List<Payment> mockPaymentHistory = [
  const Payment(
    id: 'PAY-9001',
    type: UtilityType.elektr,
    amount: 145000,
    paidAt: '2026-07-20T10:15:00',
    status: PaymentStatus.success,
    cardLast4: '4521',
  ),
  const Payment(
    id: 'PAY-9002',
    type: UtilityType.suv,
    amount: 68000,
    paidAt: '2026-07-15T09:02:00',
    status: PaymentStatus.success,
    cardLast4: '4521',
  ),
  const Payment(
    id: 'PAY-9003',
    type: UtilityType.gaz,
    amount: 92000,
    paidAt: '2026-07-10T18:40:00',
    status: PaymentStatus.success,
    cardLast4: '7788',
  ),
  const Payment(
    id: 'PAY-9004',
    type: UtilityType.chiqindi,
    amount: 25000,
    paidAt: '2026-07-08T12:00:00',
    status: PaymentStatus.failed,
    cardLast4: '3399',
  ),
  const Payment(
    id: 'PAY-9005',
    type: UtilityType.issiqlik,
    amount: 300000,
    paidAt: '2026-06-30T08:20:00',
    status: PaymentStatus.success,
    cardLast4: '4521',
  ),
  const Payment(
    id: 'PAY-9006',
    type: UtilityType.elektr,
    amount: 130000,
    paidAt: '2026-06-20T11:05:00',
    status: PaymentStatus.success,
    cardLast4: '7788',
  ),
  const Payment(
    id: 'PAY-9007',
    type: UtilityType.suv,
    amount: 54000,
    paidAt: '2026-06-14T16:30:00',
    status: PaymentStatus.pending,
    cardLast4: '3399',
  ),
  const Payment(
    id: 'PAY-9008',
    type: UtilityType.gaz,
    amount: 87000,
    paidAt: '2026-06-05T09:50:00',
    status: PaymentStatus.success,
    cardLast4: '4521',
  ),
];

/// To'lov sahifasida tanlash uchun saqlangan (mock) kartalar — har biri
/// FIXED (tasodifiy emas) balans bilan. `PayPage`dagi karta-karuselida
/// ko'rsatiladi; foydalanuvchi shulardan birini tanlaydi yoki yangi karta
/// qo'lda kiritadi.
final List<SavedCard> mockSavedCards = [
  const SavedCard(
    id: 'CARD-UZCARD-1',
    network: CardNetwork.uzcard,
    fullNumber: '8600 0000 0000 0006',
    balance: 2450000,
    expiry: '12/28',
  ),
  const SavedCard(
    id: 'CARD-HUMO-1',
    network: CardNetwork.humo,
    fullNumber: '9860 0000 0000 4521',
    balance: 780000,
    expiry: '03/27',
  ),
  const SavedCard(
    id: 'CARD-VISA-1',
    network: CardNetwork.visa,
    fullNumber: '4111 1111 1111 7788',
    balance: 5120000,
    expiry: '09/29',
  ),
];
