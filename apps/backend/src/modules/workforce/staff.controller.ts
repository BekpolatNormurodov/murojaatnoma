import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Staff } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

// NOTE: all routes below are @Public() for this TEST deployment; wiring them
// behind the admin JWT guard (RBAC via ModuleKey "staff") is a later step.
@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List admin-panel staff (boshqaruv xodimlari)' })
  findAll(@Query() query: ListStaffQueryDto): Promise<Staff[]> {
    return this.staffService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a staff profile by id' })
  findOne(@Param('id') id: string): Promise<Staff> {
    return this.staffService.findOne(id);
  }

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new admin-panel staff profile' })
  create(@Body() dto: CreateStaffDto): Promise<Staff> {
    return this.staffService.create(dto);
  }

  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a staff profile' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto): Promise<Staff> {
    return this.staffService.update(id, dto);
  }

  @Public()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a staff profile' })
  remove(@Param('id') id: string): Promise<void> {
    return this.staffService.remove(id);
  }
}
