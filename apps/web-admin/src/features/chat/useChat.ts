import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { ChatConversation, ChatMessage, CreateChatMessageInput } from '@/shared/store/chat';

/**
 * Suhbatlar ro'yxatini backend'dan oladi: GET /api/chat/conversations
 * Javob shakli mock'dagi `Conversation[]` bilan bir xil (drop-in), har bir
 * element oxirgi xabar (`lastMessage`) va o'qilmaganlar soni (`unreadCount`)
 * bilan birga keladi.
 */
export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => api.get<ChatConversation[]>('/chat/conversations'),
    staleTime: 15_000,
  });
}

/**
 * Bitta suhbatning xabarlarini (xronologik tartibda) oladi:
 * GET /api/chat/conversations/:id/messages
 */
export function useMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => api.get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
    staleTime: 10_000,
  });
}

/**
 * Suhbatga yangi xabar (matn/rasm/fayl/ovoz) yuboradi:
 * POST /api/chat/conversations/:id/messages
 * Muvaffaqiyatli bo'lsa, shu suhbat xabarlari va suhbatlar ro'yxatini
 * (oxirgi xabar/unread hisobi yangilanishi uchun) qayta so'raydi.
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      ...body
    }: { conversationId: string } & CreateChatMessageInput) =>
      api.post<ChatMessage>(`/chat/conversations/${conversationId}/messages`, body),
    onSuccess: (_message, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['chat', 'messages', variables.conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

/**
 * Suhbatdagi barcha (o'zimiznikidan boshqa) xabarlarni o'qilgan deb
 * belgilaydi: PATCH /api/chat/conversations/:id/read
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.patch<{ ok: boolean }>(`/chat/conversations/${conversationId}/read`),
    onSuccess: (_result, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

/**
 * Foydalanuvchi tizim darajasida "kamaytirilgan animatsiya"ni yoqqan-yoqmaganini
 * kuzatadi (`prefers-reduced-motion: reduce`). Suhbat oynasidagi skroll xatti-
 * harakati va bezak animatsiyalarini shunga moslashtirish uchun ishlatiladi.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
