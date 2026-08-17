import { ChatConvKind, ChatMessage } from '@prisma/client';

/**
 * Drop-in shape for web-admin's `Conversation` (shared/store/chat.ts), plus
 * the two derived fields the chat list UI needs (`lastMessage`, `unreadCount`)
 * — previously computed client-side from the full in-store message array,
 * now computed once here so the frontend doesn't have to fetch every
 * conversation's messages just to render the sidebar list.
 */
export interface ChatConversationResponse {
  id: string;
  kind: ChatConvKind;
  title: string;
  subtitle: string | null;
  avatarColor: string | null;
  photo: string | null;
  staffId: string | null;
  online: boolean;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}
