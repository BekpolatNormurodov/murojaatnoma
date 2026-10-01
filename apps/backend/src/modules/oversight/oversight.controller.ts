import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { ListSalariesQueryDto } from '../salaries/dto/list-salaries-query.dto';
import { UpsertEmployeeDto } from './dto/upsert-employee.dto';
import { OversightService } from './oversight.service';

/**
 * Hokimiyat nazorati (oversight) — one read-only endpoint that fuses each
 * employee's face-enrollment, today's keldi-ketdi/soat, territory (hudud) and
 * monthly oylik. web-admin only.
 */
@ApiTags('oversight')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('oversight')
export class OversightController {
  constructor(private readonly oversight: OversightService) {}

  @Get()
  @ApiOperation({ summary: 'Xodimlar nazorati: face + davomat + hudud + oylik (bitta jadval)' })
  overview(@Query() query: ListSalariesQueryDto) {
    return this.oversight.overview(query.year, query.month);
  }

  @Post('employee')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: "Yangi xodim qo'shish (login + rasm + oylik) — SUPER_ADMIN" })
  createEmployee(@Body() dto: UpsertEmployeeDto) {
    return this.oversight.createEmployee(dto);
  }

  @Patch('employee/:id')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Xodimni tahrirlash (ism/lavozim/rasm/parol/oylik) — SUPER_ADMIN' })
  updateEmployee(@Param('id') id: string, @Body() dto: UpsertEmployeeDto) {
    return this.oversight.updateEmployee(id, dto);
  }
}
