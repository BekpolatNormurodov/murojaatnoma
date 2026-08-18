import {
  Controller,
  Body,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { BonusesService, BonusResponse } from './bonuses.service';
import { CreateBonusDto } from './dto/create-bonus.dto';
import { ListBonusesQueryDto } from './dto/list-bonuses-query.dto';
import { UpdateBonusDto } from './dto/update-bonus.dto';

/**
 * Employee bonuses (premya). Admins grant bonuses (web-admin); an employee
 * may read only their own history (worker-app).
 *
 * SECURITY: the whole controller is `@RequireScope('admin')` by default —
 * writes and the full admin list are web-admin territory. The single
 * `GET /bonuses/employee/:employeeId` route below overrides that to
 * `('admin', 'employee')` and enforces OWNER-OR-ADMIN in-handler
 * (`assertCanView`), mirroring the pattern in `EmployeesController`.
 */
@ApiTags('bonuses')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('bonuses')
export class BonusesController {
  constructor(private readonly bonusesService: BonusesService) {}

  private assertCanView(user: AuthenticatedUser, targetEmployeeId: string): void {
    if (user.scope === 'admin') return;
    if (user.scope === 'employee' && user.employeeId === targetEmployeeId) return;
    throw new ForbiddenException('You may only view your own bonuses.');
  }

  @Post()
  @ApiOperation({ summary: 'Grant a new bonus (premya) to an employee/worker' })
  create(@Body() dto: CreateBonusDto): Promise<BonusResponse> {
    return this.bonusesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all bonuses, newest first (optional ?month filter)' })
  findAll(@Query() query: ListBonusesQueryDto): Promise<BonusResponse[]> {
    return this.bonusesService.findAll(query);
  }

  @Get('employee/:employeeId')
  @RequireScope('admin', 'employee')
  @ApiOperation({ summary: "An employee's own bonuses, newest first (own id, or admin)" })
  findByEmployee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BonusResponse[]> {
    this.assertCanView(user, employeeId);
    return this.bonusesService.findByEmployee(employeeId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a bonus (amount/reason/month/recipient)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBonusDto,
  ): Promise<BonusResponse> {
    return this.bonusesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a bonus' })
  remove(@Param('id') id: string): Promise<void> {
    return this.bonusesService.remove(id);
  }
}
