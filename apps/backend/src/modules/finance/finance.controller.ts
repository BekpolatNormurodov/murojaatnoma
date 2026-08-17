import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FinanceMonthly, UtilityMonthly, UtilityPayment } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { FinanceService } from './finance.service';

// NOTE: all routes are @Public() for now — auth-gating (JWT + roles) is a
// later step once the web-admin login flow is wired up.
@ApiTags('finance')
@Controller()
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Public()
  @Get('finance/monthly')
  @ApiOperation({ summary: "Oylik byudjet/sarf/aylanma seriyasi (12 oy)" })
  monthly(): Promise<FinanceMonthly[]> {
    return this.financeService.monthly();
  }

  @Public()
  @Get('utility/payments')
  @ApiOperation({ summary: "Kommunal to'lovlar (tuman/tur kesimida)" })
  utilityPayments(): Promise<UtilityPayment[]> {
    return this.financeService.utilityPayments();
  }

  @Public()
  @Get('utility/monthly')
  @ApiOperation({ summary: "Kommunal to'lovlar oylik seriyasi (tur kesimida, 12 oy)" })
  utilityMonthly(): Promise<UtilityMonthly[]> {
    return this.financeService.utilityMonthly();
  }
}
