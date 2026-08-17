import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { AppUsersService } from './app-users.service';
import { ListAppUsersQueryDto } from './dto/list-app-users-query.dto';
import {
  AppUserDauPoint,
  AppUserGrowthPoint,
  AppUserResponse,
  AppUserStats,
} from './interfaces/app-user-response.interface';

/**
 * Mobil ilova foydalanuvchilari (App Users) — read-only admin endpoints.
 *
 * All routes are @Public() for now: auth-gating (admin JWT guard) is a
 * later step, wired in once the web-admin session/login flow lands.
 */
@ApiTags('app-users')
@Controller('app-users')
export class AppUsersController {
  constructor(private readonly appUsersService: AppUsersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List app (mobile) users, paginated' })
  findAll(@Query() query: ListAppUsersQueryDto): Promise<Paginated<AppUserResponse>> {
    return this.appUsersService.findAll(query);
  }

  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'App user aggregate stats (totals by status/device, ratings, etc.)' })
  stats(): Promise<AppUserStats> {
    return this.appUsersService.stats();
  }

  @Public()
  @Get('dau')
  @ApiOperation({ summary: 'Daily active users over the last 14 days' })
  dau(): Promise<AppUserDauPoint[]> {
    return this.appUsersService.dau();
  }

  @Public()
  @Get('growth')
  @ApiOperation({ summary: 'Monthly registration growth over the last 8 months' })
  growth(): Promise<AppUserGrowthPoint[]> {
    return this.appUsersService.growth();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a single app user by id' })
  findOne(@Param('id') id: string): Promise<AppUserResponse> {
    return this.appUsersService.findOne(id);
  }
}
