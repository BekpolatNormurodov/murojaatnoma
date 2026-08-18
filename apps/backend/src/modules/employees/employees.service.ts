import { Injectable, NotFoundException } from '@nestjs/common';
import { Employee, FaceTemplate } from '@prisma/client';
import { Paginated } from '../../common/interfaces/paginated.interface';

/**
 * Employee enriched with a computed `hasFace` flag (whether the employee has
 * at least one enrolled face template). Lets the web-admin show a read-only
 * "Yuz ro'yxatdan o'tgan: ha/yo'q" status without exposing the biometric
 * embeddings themselves. `hasFace` is derived from a count — NOT a schema
 * column, so it needs no migration.
 */
export type EmployeeWithFace = Employee & { hasFace: boolean };
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

    const data = rows.map(({ _count, ...employee }) => ({
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
    const { _count, ...rest } = employee;
    return { ...rest, hasFace: _count.faceTemplates > 0 };
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    await this.findOne(id);
    return this.prisma.employee.update({ where: { id }, data: dto });
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
