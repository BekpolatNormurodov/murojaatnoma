import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

/**
 * Super-admin management of other web-admin accounts. Mounted under
 * /auth/admin/users. `@RequireScope('admin')` proves an admin token; the
 * class-level `SuperAdminGuard` narrows every route to SUPER_ADMIN principals
 * (returns 403 otherwise). The web-admin "Adminlar" page consumes this.
 */
@ApiTags('admin-users')
@ApiBearerAuth()
@RequireScope('admin')
@UseGuards(SuperAdminGuard)
@Controller('auth/admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new admin account (super-admin only)' })
  create(@Body() dto: CreateAdminDto) {
    return this.adminUsersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all admin accounts (super-admin only)' })
  findAll() {
    return this.adminUsersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one admin account (super-admin only)' })
  findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an admin account (super-admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminUsersService.update(id, dto, user.employeeId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an admin account (super-admin only)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.adminUsersService.remove(id, user.employeeId);
  }
}
