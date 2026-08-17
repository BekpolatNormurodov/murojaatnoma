import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

interface HealthStatus {
  status: 'ok' | 'error';
  uptimeSeconds: number;
  database: 'up' | 'down';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness/readiness probe, including a DB ping' })
  async check(): Promise<HealthStatus> {
    let database: 'up' | 'down' = 'up';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    const status: HealthStatus = {
      status: database === 'up' ? 'ok' : 'error',
      uptimeSeconds: Math.round(process.uptime()),
      database,
      timestamp: new Date().toISOString(),
    };

    if (status.status === 'error') {
      throw new ServiceUnavailableException(status);
    }

    return status;
  }
}
