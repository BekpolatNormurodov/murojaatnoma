import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreatePremyaDto } from './dto/create-premya.dto';
import { PremyaRequestDto, PremyaService } from './premya.service';

/** Employee bonus requests (worker-app "Premya so'rash"). */
@ApiTags('premya')
@ApiBearerAuth()
@Controller('premya')
export class PremyaController {
  constructor(private readonly premyaService: PremyaService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new bonus request for the authenticated employee' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePremyaDto,
  ): Promise<PremyaRequestDto> {
    return this.premyaService.create(user.employeeId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'My bonus requests, newest first' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<PremyaRequestDto[]> {
    return this.premyaService.findMine(user.employeeId);
  }
}
