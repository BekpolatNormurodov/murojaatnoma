import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { SuggestionsService } from './suggestions.service';

/** Employee rationalization suggestions (worker-app "Takliflar"). */
@ApiTags('suggestions')
@ApiBearerAuth()
@RequireScope('employee')
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get()
  @ApiOperation({ summary: 'List suggestions (most-voted first)' })
  list() {
    return this.suggestionsService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Submit a suggestion' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSuggestionDto) {
    return this.suggestionsService.create(user.employeeId, dto);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Vote for a suggestion (one per employee)' })
  vote(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.suggestionsService.vote(user.employeeId, id);
  }
}
