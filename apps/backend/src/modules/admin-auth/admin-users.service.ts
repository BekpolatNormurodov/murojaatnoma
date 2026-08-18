import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, AdminUser, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

/** Public shape of an admin account — never exposes `passwordHash`. */
export interface AdminUserProfile {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Super-admin management of web-admin accounts. Every returned admin is mapped
 * to a profile that omits `passwordHash`. Access is gated at the controller
 * (`@RequireScope('admin')` + `SuperAdminGuard`); the lockout guards here stop a
 * super-admin from locking themselves — or every super-admin — out.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAdminDto): Promise<AdminUserProfile> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const admin = await this.prisma.adminUser.create({
        data: {
          username: dto.username.trim(),
          email: dto.email?.trim() || null,
          passwordHash,
          fullName: dto.fullName.trim(),
          role: dto.role,
        },
      });
      this.logger.log(`Admin created: ${admin.username} (${admin.role})`);
      return this.toProfile(admin);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bunday login yoki email allaqachon mavjud');
      }
      throw error;
    }
  }

  async findAll(): Promise<AdminUserProfile[]> {
    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return admins.map((admin) => this.toProfile(admin));
  }

  async findOne(id: string): Promise<AdminUserProfile> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Admin topilmadi');
    }
    return this.toProfile(admin);
  }

  async update(
    id: string,
    dto: UpdateAdminDto,
    callerId: string,
  ): Promise<AdminUserProfile> {
    const target = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Admin topilmadi');
    }

    const isSelf = id === callerId;
    const demotingFromSuperAdmin =
      target.role === AdminRole.SUPER_ADMIN &&
      dto.role !== undefined &&
      dto.role !== AdminRole.SUPER_ADMIN;
    const deactivating = dto.isActive === false;

    // Lockout safety: can't demote/deactivate yourself.
    if (isSelf && (demotingFromSuperAdmin || deactivating)) {
      throw new BadRequestException("O'zingizni o'chira/o'zgartira olmaysiz");
    }

    // Lockout safety: never demote/deactivate the last active super-admin.
    if (
      target.role === AdminRole.SUPER_ADMIN &&
      target.isActive &&
      (demotingFromSuperAdmin || deactivating)
    ) {
      await this.assertNotLastActiveSuperAdmin();
    }

    const data: Prisma.AdminUserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    try {
      const admin = await this.prisma.adminUser.update({ where: { id }, data });
      this.logger.log(`Admin updated: ${admin.username}`);
      return this.toProfile(admin);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bunday login yoki email allaqachon mavjud');
      }
      throw error;
    }
  }

  async remove(id: string, callerId: string): Promise<{ id: string }> {
    const target = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Admin topilmadi');
    }

    // Lockout safety: can't delete yourself.
    if (id === callerId) {
      throw new BadRequestException("O'zingizni o'chira/o'zgartira olmaysiz");
    }

    // Lockout safety: never delete the last active super-admin.
    if (target.role === AdminRole.SUPER_ADMIN && target.isActive) {
      await this.assertNotLastActiveSuperAdmin();
    }

    await this.prisma.adminUser.delete({ where: { id } });
    this.logger.log(`Admin deleted: ${target.username}`);
    return { id };
  }

  /** Blocks the operation when only one active super-admin remains. */
  private async assertNotLastActiveSuperAdmin(): Promise<void> {
    const activeSuperAdmins = await this.prisma.adminUser.count({
      where: { role: AdminRole.SUPER_ADMIN, isActive: true },
    });
    if (activeSuperAdmins <= 1) {
      throw new BadRequestException(
        "Oxirgi faol super-adminni o'chira/o'zgartira olmaysiz",
      );
    }
  }

  private toProfile(admin: AdminUser): AdminUserProfile {
    return {
      id: admin.id,
      username: admin.username,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
