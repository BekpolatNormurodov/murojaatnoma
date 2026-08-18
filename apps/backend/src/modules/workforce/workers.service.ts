import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Worker, WorkerStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

/**
 * Dala ishchilari (field workers) — profile list + detail only.
 * Attendance/check-in business logic lives in another module; the
 * `attendance`/`documents` JSON columns below are relayed as-is because
 * they are part of the `Worker` row itself (mirrors the mock `Worker` type).
 */
@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListWorkersQueryDto): Promise<Worker[]> {
    const { districtId, status, specialization, search } = query;

    const where: Prisma.WorkerWhereInput = {
      ...(districtId ? { districtId } : {}),
      ...(status ? { status } : {}),
      ...(specialization ? { specialization: { has: specialization } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.worker.findMany({ where, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string): Promise<Worker> {
    const worker = await this.prisma.worker.findUnique({ where: { id } });
    if (!worker) {
      throw new NotFoundException(`Worker ${id} not found`);
    }
    return worker;
  }

  /**
   * `POST /workers` — new field-worker profile from the web-admin "Yangi
   * ishchi" form. Server always generates `id` (`w-` prefixed, matching the
   * seed's `w1`/`w2`/... family) and `createdAt` (DB default). A brand-new
   * hire has no operational history yet, so stat/attendance fields not
   * supplied by the caller default to a blank slate.
   */
  async create(dto: CreateWorkerDto): Promise<Worker> {
    return this.prisma.worker.create({
      data: {
        id: `w-${Date.now()}`,
        name: dto.name,
        photo: dto.photo,
        avatarColor: dto.avatarColor,
        position: dto.position,
        region: dto.region,
        districtId: dto.districtId,
        phone: dto.phone,
        // Worker.email is a non-null column but email is now optional on the
        // form/DTO — default to '' when omitted so creation doesn't fail.
        email: dto.email ?? '',
        specialization: dto.specialization,
        status: dto.status ?? WorkerStatus.offline,
        insideRegion: dto.insideRegion ?? false,
        rating: dto.rating ?? 0,
        points: dto.points ?? 0,
        completedTasks: dto.completedTasks ?? 0,
        activeTasks: dto.activeTasks ?? 0,
        lat: dto.lat ?? 0,
        lng: dto.lng ?? 0,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : new Date(),
        checkInTime: dto.checkInTime ?? null,
        checkOutTime: dto.checkOutTime ?? null,
        todayConfirmed: dto.todayConfirmed ?? false,
        attendanceRate: dto.attendanceRate ?? 0,
        onTimeRate: dto.onTimeRate ?? 0,
        monthlyHours: dto.monthlyHours ?? 0,
        attendance: (dto.attendance ?? []) as unknown as Prisma.InputJsonValue,
        salary: dto.salary ?? 0,
        bonus: dto.bonus ?? 0,
        vehicle: dto.vehicle ?? null,
        documents: (dto.documents ?? []) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** `PATCH /workers/:id` — partial update; only supplied fields are touched. */
  async update(id: string, dto: UpdateWorkerDto): Promise<Worker> {
    await this.findOne(id);

    return this.prisma.worker.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.photo !== undefined ? { photo: dto.photo } : {}),
        ...(dto.avatarColor !== undefined ? { avatarColor: dto.avatarColor } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.region !== undefined ? { region: dto.region } : {}),
        ...(dto.districtId !== undefined ? { districtId: dto.districtId } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.specialization !== undefined ? { specialization: dto.specialization } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.insideRegion !== undefined ? { insideRegion: dto.insideRegion } : {}),
        ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
        ...(dto.points !== undefined ? { points: dto.points } : {}),
        ...(dto.completedTasks !== undefined ? { completedTasks: dto.completedTasks } : {}),
        ...(dto.activeTasks !== undefined ? { activeTasks: dto.activeTasks } : {}),
        ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
        ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
        ...(dto.hiredAt !== undefined ? { hiredAt: new Date(dto.hiredAt) } : {}),
        ...(dto.checkInTime !== undefined ? { checkInTime: dto.checkInTime } : {}),
        ...(dto.checkOutTime !== undefined ? { checkOutTime: dto.checkOutTime } : {}),
        ...(dto.todayConfirmed !== undefined ? { todayConfirmed: dto.todayConfirmed } : {}),
        ...(dto.attendanceRate !== undefined ? { attendanceRate: dto.attendanceRate } : {}),
        ...(dto.onTimeRate !== undefined ? { onTimeRate: dto.onTimeRate } : {}),
        ...(dto.monthlyHours !== undefined ? { monthlyHours: dto.monthlyHours } : {}),
        ...(dto.attendance !== undefined
          ? { attendance: dto.attendance as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.salary !== undefined ? { salary: dto.salary } : {}),
        ...(dto.bonus !== undefined ? { bonus: dto.bonus } : {}),
        ...(dto.vehicle !== undefined ? { vehicle: dto.vehicle } : {}),
        ...(dto.documents !== undefined
          ? { documents: dto.documents as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  /** `DELETE /workers/:id` — hard delete (no soft-delete field on this model). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.worker.delete({ where: { id } });
  }
}
