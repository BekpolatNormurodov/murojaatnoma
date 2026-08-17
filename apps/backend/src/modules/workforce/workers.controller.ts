import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Worker } from '@prisma/client';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { WorkersService } from './workers.service';

// NOTE: all routes below are @Public() for this TEST deployment; wiring them
// behind the admin JWT guard (RBAC via ModuleKey "workers") is a later step.
@ApiTags('workers')
@RequireScope('admin')
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @ApiOperation({ summary: 'List field workers (dala ishchilari)' })
  findAll(@Query() query: ListWorkersQueryDto): Promise<Worker[]> {
    return this.workersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a field worker profile by id' })
  findOne(@Param('id') id: string): Promise<Worker> {
    return this.workersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new field worker profile' })
  create(@Body() dto: CreateWorkerDto): Promise<Worker> {
    return this.workersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a field worker profile' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto): Promise<Worker> {
    return this.workersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a field worker profile' })
  remove(@Param('id') id: string): Promise<void> {
    return this.workersService.remove(id);
  }
}
