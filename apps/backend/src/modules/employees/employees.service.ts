import { Injectable, NotFoundException } from '@nestjs/common';
import { Employee, FaceTemplate, Prisma } from '@prisma/client';
import { Paginated } from '../../common/interfaces/paginated.interface';

/**
 * Employee enriched with a computed `hasFace` flag (whether the employee has
 * at least one enrolled face template). Lets the web-admin show a read-only
 * "Yuz ro'yxatdan o'tgan: ha/yo'q" status without exposing the biometric
 * embeddings themselves. `hasFace` is derived from a count — NOT a schema
 * column, so it needs no migration.
 */
/** Public employee shape — NEVER includes the bcrypt `passwordHash`. */
export type EmployeeWithFace = Omit<Employee, 'passwordHash'> & { hasFace: boolean };
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EnrollFaceDto } from './dto/enroll-face.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEmployeeDto): Promise<Employee> {
    return this.prisma.employee.create({ data: dto });
  }

  async findAll(
    query: ListEmployeesQueryDto,
  ): Promise<Paginated<EmployeeWithFace>> {
    const { page, limit, region, district } = query;
    const where = {
      ...(region ? { region } : {}),
      ...(district ? { district } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { faceTemplates: true } } },
      }),
      this.prisma.employee.count({ where }),
    ]);

    const data = rows.map(({ _count, passwordHash: _pw, ...employee }) => ({
      ...employee,
      hasFace: _count.faceTemplates > 0,
    }));

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<EmployeeWithFace> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: { faceTemplates: true } } },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }
    const { _count, passwordHash: _pw, ...rest } = employee;
    return { ...rest, hasFace: _count.faceTemplates > 0 };
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<EmployeeWithFace> {
    await this.findOne(id);
    const data: Prisma.EmployeeUncheckedUpdateInput = { ...dto };
    // Territory reassignment must re-evaluate the denormalized in-zone flag
    // against the LAST known position immediately — otherwise the admin live-map
    // keeps showing stale "Hududda/Tashqarida" until the employee's next report
    // (which may never come if the app isn't installed). Office presence always
    // counts; empty assignment => whole district.
    if (dto.assignedMahallaCodes !== undefined) {
      const last = await this.prisma.employee.findUnique({
        where: { id },
        select: { lastMahallaCode: true, lastInsideDistrict: true, lastInsideOffice: true },
      });
      if (last) {
        const codes = dto.assignedMahallaCodes;
        data.lastInsideAssignedZone =
          last.lastInsideOffice ||
          (codes.length === 0
            ? last.lastInsideDistrict
            : last.lastMahallaCode != null && codes.includes(last.lastMahallaCode));
      }
    }
    const updated = await this.prisma.employee.update({
      where: { id },
      data,
      include: { _count: { select: { faceTemplates: true } } },
    });
    const { _count, passwordHash: _pw, ...rest } = updated;
    return { ...rest, hasFace: _count.faceTemplates > 0 };
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.employee.delete({ where: { id } });
  }

  async enrollFace(id: string, dto: EnrollFaceDto): Promise<FaceTemplate> {
    await this.findOne(id);
    return this.prisma.faceTemplate.create({
      data: { employeeId: id, embedding: dto.embedding },
    });
  }

  findFaceTemplates(id: string): Promise<FaceTemplate[]> {
    return this.prisma.faceTemplate.findMany({
      where: { employeeId: id },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
