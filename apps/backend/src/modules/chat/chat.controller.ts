import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatMessage } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { ChatService } from './chat.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { ListChatMessagesQueryDto } from './dto/list-chat-messages-query.dto';
import { ChatConversationResponse } from './interfaces/chat-conversation-response.interface';

// NOTE: all routes are @Public() for now — auth-gating (JWT + roles) is a
// later step once the web-admin login flow is wired up (same convention as
// complaints/staff/requests).
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Get('conversations')
  @ApiOperation({
    summary: "Suhbatlar ro'yxati (oxirgi xabar + o'qilmaganlar soni bilan)",
  })
  findAllConversations(): Promise<ChatConversationResponse[]> {
    return this.chatService.findAllConversations();
  }

  @Public()
  @Post('conversations/direct')
  @ApiOperation({
    summary:
      "Xodim bilan shaxsiy suhbatni ochish (mavjud bo'lsa qaytaradi, bo'lmasa yaratadi) — xarita va umumiy chat'dagi \"Xodimga yozish\" tugmalari shu endpoint'ni ishlatadi",
  })
  openDirectConversation(
    @Body() dto: CreateDirectConversationDto,
  ): Promise<ChatConversationResponse> {
    return this.chatService.openDirectConversation(dto);
  }

  @Public()
  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Suhbat xabarlari (xronologik tartibda, sahifalash bilan)' })
  findMessages(
    @Param('id') id: string,
    @Query() query: ListChatMessagesQueryDto,
  ): Promise<ChatMessage[]> {
    return this.chatService.findMessages(id, query);
  }

  @Public()
  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Suhbatga yangi xabar yuborish (matn/rasm/fayl/ovoz)' })
  sendMessage(
    @Param('id') id: string,
    @Body() dto: CreateChatMessageDto,
  ): Promise<ChatMessage> {
    return this.chatService.sendMessage(id, dto);
  }

  @Public()
  @Patch('conversations/:id/read')
  @ApiOperation({ summary: "Suhbatdagi barcha xabarlarni o'qilgan deb belgilash" })
  markRead(@Param('id') id: string): Promise<{ ok: true }> {
    return this.chatService.markRead(id);
  }
}
