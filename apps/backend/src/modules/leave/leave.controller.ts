import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { LeaveRequestDto, LeaveService } from './leave.service';

/** Employee leave requests (worker-app "Ta'til so'rovi"). */
@ApiTags('leave')
@ApiBearerAuth()
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new leave request for the authenticated employee' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeaveDto,
  ): Promise<LeaveRequestDto> {
    return this.leaveService.create(user.employeeId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'My leave requests, newest first' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<LeaveRequestDto[]> {
    return this.leaveService.findMine(user.employeeId);
  }
}
