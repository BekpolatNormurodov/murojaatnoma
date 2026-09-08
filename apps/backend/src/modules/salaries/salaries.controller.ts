import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ListSalariesQueryDto } from './dto/list-salaries-query.dto';
import { UpsertSalaryDto } from './dto/upsert-salary.dto';
import { SalariesService, SalaryDto } from './salaries.service';

/**
 * Monthly salary (Oylik maosh). The whole controller is admin territory
 * (`@RequireScope('admin')`) — only web-admin sets/edits salaries — except
 * `GET /salaries/me`, which a mobile employee uses to read their OWN salary.
 */
@ApiTags('salaries')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('salaries')
export class SalariesController {
  constructor(private readonly salaries: SalariesService) {}

  @Get()
  @ApiOperation({ summary: 'Oylik maosh jadvali (har bir xodim, tanlangan oy)' })
  roster(@Query() query: ListSalariesQueryDto) {
    return this.salaries.monthlyRoster(query.year, query.month);
  }

  @Get('me')
  @RequireScope('employee', 'admin')
  @ApiOperation({ summary: "O'z oyliklarim (worker-app), ixtiyoriy year/month filtri" })
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSalariesQueryDto,
  ): Promise<SalaryDto[]> {
    return this.salaries.mine(user.employeeId!, query.year, query.month);
  }

  @Get('employee/:id')
  @ApiOperation({ summary: "Bitta xodimning oylik tarixi (barcha oylar)" })
  history(@Param('id') id: string): Promise<SalaryDto[]> {
    return this.salaries.history(id);
  }

  @Put()
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Oylik maoshni belgilash/tahrirlash (upsert) — SUPER_ADMIN only' })
  upsert(@Body() dto: UpsertSalaryDto): Promise<SalaryDto> {
    return this.salaries.upsert(dto);
  }

  @Delete(':id')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Oylik yozuvini o'chirish — SUPER_ADMIN only" })
  remove(@Param('id') id: string): Promise<void> {
    return this.salaries.remove(id);
  }
}
