import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Worker } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import { WorkersService } from './workers.service';

// NOTE: all routes below are @Public() for this TEST deployment; wiring them
// behind the admin JWT guard (RBAC via ModuleKey "workers") is a later step.
@ApiTags('workers')
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List field workers (dala ishchilari)' })
  findAll(@Query() query: ListWorkersQueryDto): Promise<Worker[]> {
    return this.workersService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a field worker profile by id' })
  findOne(@Param('id') id: string): Promise<Worker> {
    return this.workersService.findOne(id);
  }
}
