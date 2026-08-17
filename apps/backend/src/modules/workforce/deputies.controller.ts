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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Deputy } from '@prisma/client';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { CreateDeputyDto } from './dto/create-deputy.dto';
import { UpdateDeputyDto } from './dto/update-deputy.dto';
import { DeputiesService } from './deputies.service';

// NOTE: all routes below are @Public() for this TEST deployment; wiring them
// behind the admin JWT guard is a later step.
@ApiTags('deputies')
@RequireScope('admin')
@Controller('deputies')
export class DeputiesController {
  constructor(private readonly deputiesService: DeputiesService) {}

  @Get()
  @ApiOperation({ summary: "List deputy governors (hokim o'rinbosarlari)" })
  findAll(): Promise<Deputy[]> {
    return this.deputiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a deputy governor profile by id' })
  findOne(@Param('id') id: string): Promise<Deputy> {
    return this.deputiesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new deputy governor profile' })
  create(@Body() dto: CreateDeputyDto): Promise<Deputy> {
    return this.deputiesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a deputy governor profile' })
  update(@Param('id') id: string, @Body() dto: UpdateDeputyDto): Promise<Deputy> {
    return this.deputiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a deputy governor profile' })
  remove(@Param('id') id: string): Promise<void> {
    return this.deputiesService.remove(id);
  }
}
