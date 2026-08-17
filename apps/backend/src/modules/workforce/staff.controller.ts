import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Staff } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
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
}
