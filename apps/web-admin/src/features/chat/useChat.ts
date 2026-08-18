import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { fetchLiveLocations } from '@/shared/api/locations';
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
    // Optimistik yuborish: xabar darhol "yuborilmoqda" holatida ko'rinadi
    // (server javobini kutmasdan), xatolik bo'lsa orqaga qaytariladi. Shu
    // tufayli sekin tarmoqda ham UI darhol javob beradi va yozgan matn
    // yo'qolmaydi.
    onMutate: async ({ conversationId, ...body }) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages', conversationId] });
      const previous = queryClient.getQueryData<ChatMessage[]>(['chat', 'messages', conversationId]);
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        conversationId,
        senderId: body.senderId ?? 'me',
        kind: body.kind,
        text: body.text,
        fileName: body.fileName,
        fileSize: body.fileSize,
        url: body.url,
        durationSec: body.durationSec,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', conversationId], (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { previous, conversationId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['chat', 'messages', context.conversationId], context.previous);
      }
    },
    // Har holatda (muvaffaqiyat/xato) serverdan haqiqiy holatni qayta so'raymiz —
    // optimistik xabar server qaytargan asl xabar bilan almashadi.
    onSettled: (_message, _err, variables) => {
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
 * Xodim bilan shaxsiy (DM) suhbatni ochadi/yaratadi:
 * POST /chat/conversations/direct — { employeeId, title, avatarColor? }
 * Idempotent (backend `employeeId` bo'yicha upsert qiladi): xarita sahifasidagi
 * "Yozish" tugmasi va umumiy chat'dagi "Xodimga yozish" tanlagichi — ikkalasi
 * ham shu bitta yo'lni (`ChatPage`ning `?to=<employeeId>` ishlovchisi) ishlatadi.
 * Muvaffaqiyatli bo'lsa suhbatlar ro'yxatini qayta so'raydi (yangi DM
 * ro'yxatda darhol ko'rinishi uchun).
 */
export function useOpenDirectConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { employeeId: string; title: string; avatarColor?: string }) =>
      api.post<ChatConversation>('/chat/conversations/direct', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

/**
 * Xodimlarning jonli ro'yxati — xarita sahifasi ishlatadigan aynan o'sha
 * manba (`GET /locations/latest`), bir xil query kaliti bilan (keshni
 * ulashadi). "Xodimga yozish" tanlagichi va `?to=` orqali DM ochish shu
 * yerdan ism/avatar oladi — xodim/kadrlar jadvaliga alohida so'rov
 * yubormaydi.
 */
export function useLiveEmployees() {
  return useQuery({
    queryKey: ['locations', 'latest'],
    queryFn: fetchLiveLocations,
    staleTime: 15_000,
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
