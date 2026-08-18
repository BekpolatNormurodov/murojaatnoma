import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentType, Complaint, ComplaintStatus, Prisma } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateComplaintResponseDto } from './dto/create-complaint-response.dto';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

/**
 * Mirrors `ComplaintResponse` from web-admin/src/shared/data/types.ts. The
 * `Complaint.responses` column is a Prisma `Json` field (typed as
 * `Prisma.JsonValue` on the model), so this is only a type-level view of
 * what's actually stored there — same shape the seed already writes.
 */
interface ComplaintResponse {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

/**
 * Infers the ComplaintAttachment `type` from an uploaded file's mimetype.
 *
 * NOTE: same limitation as the Application upload — `enum AttachmentType` only
 * defines PHOTO and VIDEO, so audio recordings are stored as VIDEO (the closer
 * of the two, both being time-based recorded media). Revisit once a dedicated
 * VOICE value is added.
 */
function inferAttachmentType(mimetype: string): AttachmentType {
  if (mimetype.startsWith('image/')) return AttachmentType.PHOTO;
  if (mimetype.startsWith('video/')) return AttachmentType.VIDEO;
  if (mimetype.startsWith('audio/')) return AttachmentType.VIDEO;
  throw new BadRequestException(`Unsupported file type: ${mimetype}`);
}

/** A ComplaintMessage returned together with its attachments. */
type ComplaintMessageWithAttachments = Prisma.ComplaintMessageGetPayload<{
  include: { attachments: true };
}>;

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Every field on `Complaint` (including the `responses` Json column, which
   * already stores `ComplaintResponse[]`-shaped objects) lines up 1:1 with
   * the web-admin mock's `Complaint` interface, so rows are returned as-is —
   * Nest's JSON serializer turns `Date` fields into ISO strings automatically.
   */
  findAll(query: ListComplaintsQueryDto): Promise<Complaint[]> {
    const { status, severity } = query;
    const where = {
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
    };

    return this.prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Complaint> {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }
    return complaint;
  }

  /**
   * `PATCH /complaints/:id` — status transition. `resolvedAt` is derived
   * server-side (mirrors the web-admin store's optimistic-update logic):
   * it's stamped the moment `status` becomes `resolved` or `rejected`
   * (keeping any prior value if it was already set), and cleared whenever
   * the status moves back to `new`/`reviewing`.
   */
  async update(id: string, dto: UpdateComplaintDto): Promise<Complaint> {
    const existing = await this.findOne(id);

    const nextStatus = dto.status ?? existing.status;
    const done = nextStatus === ComplaintStatus.resolved || nextStatus === ComplaintStatus.rejected;

    return this.prisma.complaint.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.status
          ? { resolvedAt: done ? (existing.resolvedAt ?? new Date()) : null }
          : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
      },
    });
  }

  /**
   * `POST /complaints/:id/response` — appends a new official reply to the
   * `responses` Json array. Mirrors the web-admin store's local
   * `addResponse()`: the first response moves a `new` complaint to
   * `reviewing`.
   */
  async addResponse(id: string, dto: CreateComplaintResponseDto): Promise<Complaint> {
    const existing = await this.findOne(id);
    const responses = (existing.responses as unknown as ComplaintResponse[] | null) ?? [];

    const response: ComplaintResponse = {
      id: `${id}-r${responses.length + 1}`,
      text: dto.text,
      author: dto.author ?? 'Hokimiyat',
      createdAt: new Date().toISOString(),
    };

    const nextResponses = [...responses, response];
    const nextStatus =
      existing.status === ComplaintStatus.new ? ComplaintStatus.reviewing : existing.status;

    return this.prisma.complaint.update({
      where: { id },
      data: {
        responses: nextResponses as unknown as Prisma.InputJsonValue,
        status: nextStatus,
      },
    });
  }

  /**
   * `POST /complaints/:id/messages` — appends a message to the complaint's
   * media thread. If `file` is present it is persisted exactly like the
   * Application upload: the file is already written to UPLOADS_DIR by Multer,
   * and here we build its public URL (`${publicBaseUrl}/uploads/<file>`),
   * infer the AttachmentType from the mimetype, and create a linked
   * ComplaintAttachment. Returns the created message WITH its attachments.
   */
  async addMessage(
    complaintId: string,
    input: { text?: string; authorName?: string; file?: Express.Multer.File },
  ): Promise<ComplaintMessageWithAttachments> {
    await this.findOne(complaintId);

    const { text, authorName, file } = input;

    let attachmentCreate: Prisma.ComplaintAttachmentCreateWithoutMessageInput | undefined;
    if (file) {
      const { publicBaseUrl } = this.configService.get('uploads', { infer: true });
      attachmentCreate = {
        type: inferAttachmentType(file.mimetype),
        url: `${publicBaseUrl}/uploads/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      };
    }

    return this.prisma.complaintMessage.create({
      data: {
        complaintId,
        authorType: 'ADMIN',
        authorName: authorName ?? 'Administrator',
        text: text ?? null,
        ...(attachmentCreate ? { attachments: { create: [attachmentCreate] } } : {}),
      },
      include: { attachments: true },
    });
  }

  /**
   * `GET /complaints/:id/messages` — the complaint's media thread, oldest
   * first, each message including its attachments.
   */
  async findMessages(complaintId: string): Promise<ComplaintMessageWithAttachments[]> {
    await this.findOne(complaintId);
    return this.prisma.complaintMessage.findMany({
      where: { complaintId },
      include: { attachments: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** `DELETE /complaints/:id` — hard delete (no soft-delete field on this model). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.complaint.delete({ where: { id } });
  }
}
