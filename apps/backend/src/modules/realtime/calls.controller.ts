import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CallLog } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CallsService } from './calls.service';

/** Call history for the call-log UI (missed / incoming / outgoing badges). */
@ApiTags('calls')
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Qo'ng'iroqlar tarixi (foydalanuvchi bo'yicha)" })
  @ApiQuery({ name: 'userId', required: false, description: "Default 'me' (admin)" })
  @ApiQuery({ name: 'limit', required: false })
  history(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<CallLog[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.calls.history(userId ?? 'me', Number.isFinite(parsedLimit) ? parsedLimit : 50);
  }
}
