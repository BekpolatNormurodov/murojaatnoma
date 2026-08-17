import { Injectable, NotFoundException } from '@nestjs/common';
import { Complaint, ComplaintStatus, Prisma } from '@prisma/client';
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

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** `DELETE /complaints/:id` — hard delete (no soft-delete field on this model). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.complaint.delete({ where: { id } });
  }
}
