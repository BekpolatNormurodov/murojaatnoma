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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Complaint, ComplaintMessage } from '@prisma/client';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintMessageDto } from './dto/create-complaint-message.dto';
import { CreateComplaintResponseDto } from './dto/create-complaint-response.dto';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

// NOTE: all routes are @Public() for now — auth-gating (JWT + roles) is a
// later step once the web-admin login flow is wired up.
@ApiTags('complaints')
@RequireScope('admin')
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: "Shikoyatlar ro'yxati (status/severity bo'yicha filtr)" })
  findAll(@Query() query: ListComplaintsQueryDto): Promise<Complaint[]> {
    return this.complaintsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta shikoyatni olish' })
  findOne(@Param('id') id: string): Promise<Complaint> {
    return this.complaintsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Shikoyat statusini yangilash' })
  update(@Param('id') id: string, @Body() dto: UpdateComplaintDto): Promise<Complaint> {
    return this.complaintsService.update(id, dto);
  }

  @Post(':id/response')
  @ApiOperation({ summary: "Shikoyatga rasmiy javob qo'shish" })
  addResponse(
    @Param('id') id: string,
    @Body() dto: CreateComplaintResponseDto,
  ): Promise<Complaint> {
    return this.complaintsService.addResponse(id, dto);
  }

  @Post(':id/messages')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        authorName: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary:
      "Shikoyatga media xabar qo'shish (multipart). Field \"text\" (ixtiyoriy) + \"file\" " +
      '(ixtiyoriy, max 25MB, image/video/audio) + "authorName" (ixtiyoriy, default "Administrator").',
  })
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateComplaintMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ComplaintMessage> {
    return this.complaintsService.addMessage(id, {
      text: dto.text,
      authorName: dto.authorName,
      file,
    });
  }

  @Get(':id/messages')
  @ApiOperation({ summary: "Shikoyat media xabarlari ro'yxati (attachment'lar bilan)" })
  findMessages(@Param('id') id: string): Promise<ComplaintMessage[]> {
    return this.complaintsService.findMessages(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Shikoyatni o'chirish" })
  remove(@Param('id') id: string): Promise<void> {
    return this.complaintsService.remove(id);
  }
}
