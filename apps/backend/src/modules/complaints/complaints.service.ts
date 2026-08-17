import { Injectable, NotFoundException } from '@nestjs/common';
import { Complaint } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

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

  async update(id: string, dto: UpdateComplaintDto): Promise<Complaint> {
    await this.findOne(id);
    return this.prisma.complaint.update({
      where: { id },
      data: { ...(dto.status ? { status: dto.status } : {}) },
    });
  }
}
