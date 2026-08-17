import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Complaint } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintResponseDto } from './dto/create-complaint-response.dto';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

// NOTE: all routes are @Public() for now — auth-gating (JWT + roles) is a
// later step once the web-admin login flow is wired up.
@ApiTags('complaints')
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Shikoyatlar ro'yxati (status/severity bo'yicha filtr)" })
  findAll(@Query() query: ListComplaintsQueryDto): Promise<Complaint[]> {
    return this.complaintsService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Bitta shikoyatni olish' })
  findOne(@Param('id') id: string): Promise<Complaint> {
    return this.complaintsService.findOne(id);
  }

  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Shikoyat statusini yangilash' })
  update(@Param('id') id: string, @Body() dto: UpdateComplaintDto): Promise<Complaint> {
    return this.complaintsService.update(id, dto);
  }

  @Public()
  @Post(':id/response')
  @ApiOperation({ summary: "Shikoyatga rasmiy javob qo'shish" })
  addResponse(
    @Param('id') id: string,
    @Body() dto: CreateComplaintResponseDto,
  ): Promise<Complaint> {
    return this.complaintsService.addResponse(id, dto);
  }
}
