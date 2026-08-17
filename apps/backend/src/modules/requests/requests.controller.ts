import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { CitizenRequestResponse, RequestsService, RequestStatsResponse } from './requests.service';

/**
 * Citizen requests (murojaatlar) — admin dashboard read/update endpoints.
 *
 * NOTE: all routes here are `@Public()` for now. The web-admin dashboard
 * doesn't have its auth wired up yet, so gating these behind an admin guard
 * (see `admin-auth` module) is a later step.
 */
@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List citizen requests with category/district/status/priority filters' })
  findAll(@Query() query: ListRequestsQueryDto): Promise<Paginated<CitizenRequestResponse>> {
    return this.requestsService.findAll(query);
  }

  // Registered before ':id' so "/requests/stats" doesn't get swallowed by
  // the findOne route below.
  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Aggregate counts for the requests dashboard' })
  stats(): Promise<RequestStatsResponse> {
    return this.requestsService.stats();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single citizen request by id' })
  findOne(@Param('id') id: string): Promise<CitizenRequestResponse> {
    return this.requestsService.findOne(id);
  }

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new citizen request (murojaat)' })
  create(@Body() dto: CreateRequestDto): Promise<CitizenRequestResponse> {
    return this.requestsService.create(dto);
  }

  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Update a request status and/or its assigned worker' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
  ): Promise<CitizenRequestResponse> {
    return this.requestsService.update(id, dto);
  }
}
