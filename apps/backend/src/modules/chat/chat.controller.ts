import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatMessage } from '@prisma/client';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { ChatService } from './chat.service';
import { ArchiveConversationDto } from './dto/archive-conversation.dto';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { EditChatMessageDto } from './dto/edit-chat-message.dto';
import { ListChatMessagesQueryDto } from './dto/list-chat-messages-query.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ChatConversationResponse } from './interfaces/chat-conversation-response.interface';

// Admin-scoped. web-admin (admin JWT) is the only /chat REST consumer today;
// the Socket.IO gateway independently enforces JWT+scope for the employee
// realtime path. Gating here (JwtAuthGuard requires a token, ScopeGuard requires
// admin) closes a PII hole — internal chat was previously @Public, i.e.
// world-readable/writable/deletable. Broaden to 'employee' when worker-app moves
// onto /chat. Realtime broadcasts are emitted by ChatService as domain events
// and re-broadcast by RealtimeGateway.
@ApiTags('chat')
@RequireScope('admin')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({
    summary:
      "Suhbatlar ro'yxati (oxirgi xabar + o'qilmaganlar soni). ?archived=true — arxiv ko'rinishi",
  })
  findAllConversations(
    @Query() query: ListConversationsQueryDto,
  ): Promise<ChatConversationResponse[]> {
    return this.chatService.findAllConversations(query.archived ?? false);
  }

  @Post('conversations/direct')
  @ApiOperation({
    summary:
      "Xodim bilan shaxsiy suhbatni ochish (mavjud bo'lsa qaytaradi, bo'lmasa yaratadi)",
  })
  openDirectConversation(
    @Body() dto: CreateDirectConversationDto,
  ): Promise<ChatConversationResponse> {
    return this.chatService.openDirectConversation(dto);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Suhbat xabarlari (xronologik tartibda, sahifalash bilan)' })
  findMessages(
    @Param('id') id: string,
    @Query() query: ListChatMessagesQueryDto,
  ): Promise<ChatMessage[]> {
    return this.chatService.findMessages(id, query);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Suhbatga yangi xabar yuborish (matn/rasm/fayl/ovoz)' })
  sendMessage(
    @Param('id') id: string,
    @Body() dto: CreateChatMessageDto,
  ): Promise<ChatMessage> {
    return this.chatService.sendMessage(id, dto);
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: "Suhbatdagi barcha xabarlarni o'qilgan deb belgilash" })
  markRead(@Param('id') id: string): Promise<{ ok: true }> {
    return this.chatService.markRead(id);
  }

  @Patch('conversations/:id/archive')
  @ApiOperation({ summary: 'Suhbatni arxivlash / arxivdan chiqarish' })
  archiveConversation(
    @Param('id') id: string,
    @Body() dto: ArchiveConversationDto,
  ): Promise<ChatConversationResponse> {
    return this.chatService.archiveConversation(id, dto.archived);
  }

  @Delete('conversations/:id/messages')
  @ApiOperation({
    summary: "Chatni tozalash — barcha xabarlarni o'chiradi va suhbatni arxivlaydi",
  })
  clearConversation(@Param('id') id: string): Promise<{ ok: true }> {
    return this.chatService.clearConversation(id);
  }

  @Delete('conversations/:id/messages/:messageId')
  @ApiOperation({ summary: "Bitta xabarni o'chirish" })
  deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ): Promise<{ ok: true }> {
    return this.chatService.deleteMessage(id, messageId);
  }

  @Patch('conversations/:id/messages/:messageId')
  @ApiOperation({
    summary: "Xabarni tahrirlash — faqat hali o'qilmagan bo'lsa (aks holda 409)",
  })
  editMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditChatMessageDto,
  ): Promise<ChatMessage> {
    return this.chatService.editMessage(id, messageId, dto.text);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: "Suhbatni butunlay o'chirish (xabarlari bilan)" })
  deleteConversation(@Param('id') id: string): Promise<{ ok: true }> {
    return this.chatService.deleteConversation(id);
  }
}
