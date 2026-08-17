import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Staff } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';

/**
 * Boshqaruv xodimlari (admin-panel staff / RBAC users) — profile list only.
 * Maps 1:1 onto the web-admin mock's `StaffMember` shape.
 */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListStaffQueryDto): Promise<Staff[]> {
    const { role, status, department, search } = query;

    const where: Prisma.StaffWhereInput = {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(department ? { department } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { login: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.staff.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<Staff> {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) {
      throw new NotFoundException(`Staff ${id} not found`);
    }
    return staff;
  }
}
