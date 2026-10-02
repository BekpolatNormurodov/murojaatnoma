import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AdminWriterGuard } from '../../common/guards/admin-writer.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { ListSalariesQueryDto } from '../salaries/dto/list-salaries-query.dto';
import { ArchiveEmployeeDto, EmployeeMurojaatQueryDto, UpsertEmployeeDto } from './dto/upsert-employee.dto';
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

  // Static paths before `employee/:id` so they are not taken for an id.
  @Get('departments')
  @ApiOperation({ summary: "Bo'limlar (forma tanlovi uchun)" })
  departments() {
    return this.oversight.departments();
  }

  @Get('archived')
  @ApiOperation({ summary: "Ishdan bo'shatilganlar (arxiv)" })
  archived() {
    return this.oversight.archived();
  }

  @Get('employee/:id')
  @ApiOperation({ summary: "Xodim profili: ma'lumot, ish tartibi, hudud, yuz, bu oy, 31 kun davomat, murojaatlar" })
  profile(@Param('id') id: string) {
    return this.oversight.profile(id);
  }

  @Get('employee/:id/murojaats')
  @ApiOperation({ summary: 'Xodimning murojaatlari: biriktirilgan / javob yozgan / hal qilgan (filtr bilan)' })
  murojaats(@Param('id') id: string, @Query() q: EmployeeMurojaatQueryDto) {
    return this.oversight.murojaats(id, q);
  }

  @Post('employee')
  @UseGuards(AdminWriterGuard)
  @ApiOperation({ summary: "Yangi xodim qo'shish (login + rasm + oylik + ish tartibi) — ADMIN/SUPER_ADMIN" })
  createEmployee(@Body() dto: UpsertEmployeeDto) {
    return this.oversight.createEmployee(dto);
  }

  @Patch('employee/:id')
  @UseGuards(AdminWriterGuard)
  @ApiOperation({ summary: 'Xodimni tahrirlash (hamma maydonlar) — ADMIN/SUPER_ADMIN' })
  updateEmployee(@Param('id') id: string, @Body() dto: UpsertEmployeeDto) {
    return this.oversight.updateEmployee(id, dto);
  }

  @Post('employee/:id/archive')
  @UseGuards(AdminWriterGuard)
  @ApiOperation({ summary: "Ishdan bo'shatish (arxiv): login yopiladi, tarix saqlanadi, ochiq murojaatlari bo'shatiladi" })
  archive(@Param('id') id: string, @Body() dto: ArchiveEmployeeDto) {
    return this.oversight.archive(id, dto.reason);
  }

  @Post('employee/:id/restore')
  @UseGuards(AdminWriterGuard)
  @ApiOperation({ summary: 'Arxivdan qaytarish' })
  restore(@Param('id') id: string) {
    return this.oversight.restore(id);
  }

  @Delete('employee/:id/face')
  @UseGuards(AdminWriterGuard)
  @ApiOperation({ summary: "Yuzni qayta o'rnatish: shablonlar o'chadi, xodim ilovada qayta ro'yxatdan o'tadi" })
  resetFace(@Param('id') id: string) {
    return this.oversight.resetFace(id);
  }

  @Delete('employee/:id')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Butunlay o'chirish — faqat arxivdagi xodim, SUPER_ADMIN" })
  purge(@Param('id') id: string): Promise<void> {
    return this.oversight.purge(id);
  }
}
