import { ChatMessage } from '@prisma/client';

/**
 * Domain events emitted by ChatService (and others) after a DB write, listened
 * to by the RealtimeGateway which re-broadcasts them over Socket.IO. This
 * decouples the chat module (which persists) from the realtime module (which
 * broadcasts) — no circular DI, both sides just share these names/types.
 *
 * A mutation therefore fans out live whether it arrived over REST or over a
 * socket event: the service emits once, the gateway broadcasts once.
 */
export const RT_EVENTS = {
  messageCreated: 'chat.message.created',
  messageDeleted: 'chat.message.deleted',
  messageEdited: 'chat.message.edited',
  read: 'chat.read',
  conversation: 'chat.conversation',
} as const;

export interface ChatMessageCreatedEvent {
  conversationId: string;
  message: ChatMessage;
}

export interface ChatMessageDeletedEvent {
  conversationId: string;
  messageId: string;
}

export interface ChatMessageEditedEvent {
  conversationId: string;
  message: ChatMessage;
}

export interface ChatReadEvent {
  conversationId: string;
  /** Who marked it read — "me" (admin) or the employee/staff id. */
  readerId: string;
}

export type ChatConversationAction =
  | 'archived'
  | 'cleared'
  | 'deleted'
  | 'unarchived';

export interface ChatConversationEvent {
  conversationId: string;
  action: ChatConversationAction;
  /** For direct conversations, the employee/staff id (routes to that user). */
  staffId: string | null;
}
