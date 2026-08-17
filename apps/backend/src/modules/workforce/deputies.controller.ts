import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Deputy } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { DeputiesService } from './deputies.service';

// NOTE: all routes below are @Public() for this TEST deployment; wiring them
// behind the admin JWT guard is a later step.
@ApiTags('deputies')
@Controller('deputies')
export class DeputiesController {
  constructor(private readonly deputiesService: DeputiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List deputy governors (hokim o'rinbosarlari)" })
  findAll(): Promise<Deputy[]> {
    return this.deputiesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a deputy governor profile by id' })
  findOne(@Param('id') id: string): Promise<Deputy> {
    return this.deputiesService.findOne(id);
  }
}
