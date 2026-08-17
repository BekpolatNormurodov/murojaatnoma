import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Staff, StaffStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

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

  /**
   * `POST /staff` — new admin-panel staff (RBAC user) from the web-admin
   * form. Server always generates `id` (`s-` prefixed, matching the seed's
   * `s1`/`s2`/... family). `Staff.createdAt` has no DB default, so it's
   * stamped here (or taken from the caller if supplied).
   */
  async create(dto: CreateStaffDto): Promise<Staff> {
    const schedule = dto.schedule ?? { start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };

    return this.prisma.staff.create({
      data: {
        id: `s-${Date.now()}`,
        name: dto.name,
        photo: dto.photo,
        avatarColor: dto.avatarColor,
        role: dto.role,
        position: dto.position,
        department: dto.department,
        email: dto.email,
        phone: dto.phone,
        login: dto.login,
        status: dto.status ?? StaffStatus.active,
        permissions: dto.permissions,
        schedule: schedule as unknown as Prisma.InputJsonValue,
        lastLogin: dto.lastLogin ? new Date(dto.lastLogin) : null,
        createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
        twoFactor: dto.twoFactor ?? false,
      },
    });
  }

  /** `PATCH /staff/:id` — partial update; only supplied fields are touched. */
  async update(id: string, dto: UpdateStaffDto): Promise<Staff> {
    await this.findOne(id);

    return this.prisma.staff.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.photo !== undefined ? { photo: dto.photo } : {}),
        ...(dto.avatarColor !== undefined ? { avatarColor: dto.avatarColor } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.login !== undefined ? { login: dto.login } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
        ...(dto.schedule !== undefined
          ? { schedule: dto.schedule as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.lastLogin !== undefined
          ? { lastLogin: dto.lastLogin ? new Date(dto.lastLogin) : null }
          : {}),
        ...(dto.createdAt !== undefined ? { createdAt: new Date(dto.createdAt) } : {}),
        ...(dto.twoFactor !== undefined ? { twoFactor: dto.twoFactor } : {}),
      },
    });
  }

  /** `DELETE /staff/:id` — hard delete (no soft-delete field on this model). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.staff.delete({ where: { id } });
  }
}
