import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { ListSalariesQueryDto } from '../salaries/dto/list-salaries-query.dto';
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
}
