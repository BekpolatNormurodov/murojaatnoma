import 'package:equatable/equatable.dart';

/// Hujjat turi — backend `GovDocType` (Prisma enum, qarang:
/// `apps/backend/prisma/schema.prisma`) bilan AYNAN bir xil nomlangan,
/// shu tufayli `DocumentType.values.byName(json['type'])`
/// to'g'ridan-to'g'ri ishlaydi — alohida moslashtiruvchi funksiya shart
/// emas (`meetings`/`applications` modullaridan farqli, qarang: shu
/// papkadagi `data/datasources/documents_remote_data_source.dart`).
enum DocumentType { qaror, buyruq, hisobot, shartnoma, ariza, dalolatnoma }

/// Hujjat holati — backend `GovDocStatus` (Prisma enum) bilan AYNAN bir
/// xil nomlangan (`draft`/`review`/`signed`/`archived`).
enum DocumentStatus { draft, review, signed, archived }

/// [DocumentType] uchun UI'da ko'rsatiladigan o'zbekcha yorliq.
extension DocumentTypeLabel on DocumentType {
  String get label => switch (this) {
    DocumentType.qaror => 'Qaror',
    DocumentType.buyruq => 'Buyruq',
    DocumentType.hisobot => 'Hisobot',
    DocumentType.shartnoma => 'Shartnoma',
    DocumentType.ariza => 'Ariza',
    DocumentType.dalolatnoma => 'Dalolatnoma',
  };
}

/// [DocumentStatus] uchun UI'da ko'rsatiladigan o'zbekcha yorliq.
extension DocumentStatusLabel on DocumentStatus {
  String get label => switch (this) {
    DocumentStatus.draft => 'Qoralama',
    DocumentStatus.review => "Ko'rib chiqilmoqda",
    DocumentStatus.signed => 'Imzolangan',
    DocumentStatus.archived => 'Arxivlangan',
  };
}

/// Bitta hokimiyat hujjati — ro'yxatda va tafsilotlar sahifasida
/// ko'rsatiladigan asosiy domen obyekti.
///
/// Backend `GovDocument` (Prisma modeli) satriga TO'G'RIDAN-TO'G'RI mos
/// keladi — maydon nomlari ham (camelCase) bir xil, moslashtiruvchi
/// funksiya shart emas (qarang: `apps/backend/src/modules/catalog`,
/// `CatalogController.findDocuments` — `GET /documents`, yalang'och
/// ro'yxat qaytaradi).
class DocumentItem extends Equatable {
  const DocumentItem({
    required this.id,
    required this.code,
    required this.title,
    required this.type,
    required this.status,
    required this.author,
    required this.region,
    required this.createdAt,
    required this.sizeKb,
    required this.pages,
  });

  /// Backend javobidan (`GET /documents`, bare `GovDocument[]`) yasaydi —
  /// maydon nomlari Prisma modeliga mos (camelCase): `id`, `code`,
  /// `title`, `type`, `status`, `author`, `region`, `createdAt`,
  /// `sizeKb`, `pages`.
  factory DocumentItem.fromJson(Map<String, dynamic> json) {
    return DocumentItem(
      id: json['id'] as String,
      code: json['code'] as String,
      title: json['title'] as String,
      type: DocumentType.values.byName(json['type'] as String),
      status: DocumentStatus.values.byName(json['status'] as String),
      author: json['author'] as String,
      region: json['region'] as String,
      createdAt: json['createdAt'] as String,
      sizeKb: (json['sizeKb'] as num).toInt(),
      pages: (json['pages'] as num).toInt(),
    );
  }

  final String id;

  /// Hujjat raqami/kodi — masalan `"QR-2026/118"`.
  final String code;
  final String title;
  final DocumentType type;
  final DocumentStatus status;

  /// Hujjatni tayyorlagan/imzolagan mansabdor shaxs.
  final String author;

  /// Hujjat tegishli hudud (masalan viloyat/tuman nomi).
  final String region;

  /// Yaratilgan sana (ISO-8601 satr).
  final String createdAt;

  /// Fayl hajmi (kilobaytlarda).
  final int sizeKb;

  /// Hujjat sahifalar soni.
  final int pages;

  @override
  List<Object?> get props => [
    id,
    code,
    title,
    type,
    status,
    author,
    region,
    createdAt,
    sizeKb,
    pages,
  ];

  Map<String, dynamic> toJson() => {
    'id': id,
    'code': code,
    'title': title,
    'type': type.name,
    'status': status.name,
    'author': author,
    'region': region,
    'createdAt': createdAt,
    'sizeKb': sizeKb,
    'pages': pages,
  };
}
