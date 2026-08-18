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
 *
 * `archived=false` (default) — asosiy ro'yxat (arxivlanganlarni yashiradi).
 * `archived=true` — "Arxiv" ko'rinishi (faqat arxivlangan suhbatlar). Ikkala
 * ro'yxat alohida keshlanadi (`['chat','conversations', archived]`), shu tufayli
 * ular orasida almashish darhol ishlaydi. `['chat','conversations']` prefiksini
 * invalidatsiya qilish ikkalasini ham yangilaydi (partial match).
 */
export function useConversations(archived = false) {
  return useQuery({
    queryKey: ['chat', 'conversations', archived],
    queryFn: () =>
      api.get<ChatConversation[]>(`/chat/conversations?archived=${archived}`),
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
 * Xabarni o'chiradi: DELETE /chat/conversations/:cid/messages/:mid
 * (istalgan ishtirokchi o'chira oladi). Optimistik — xabar keshdan darhol
 * olib tashlanadi; xatolik bo'lsa orqaga qaytariladi. Har holatda suhbatlar
 * ro'yxatini (oxirgi xabar preview'i uchun) qayta so'raymiz.
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) =>
      api.del<{ ok: boolean }>(`/chat/conversations/${conversationId}/messages/${messageId}`),
    onMutate: async ({ conversationId, messageId }) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'messages', conversationId] });
      const previous = queryClient.getQueryData<ChatMessage[]>(['chat', 'messages', conversationId]);
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', conversationId], (old) =>
        (old ?? []).filter((m) => m.id !== messageId),
      );
      return { previous, conversationId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['chat', 'messages', context.conversationId], context.previous);
      }
    },
    onSettled: (_result, _err, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'messages', variables.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

/**
 * Xabar matnini tahrirlaydi: PATCH /chat/conversations/:cid/messages/:mid { text }
 * Faqat xabar HALI o'qilmagan bo'lsa mumkin — o'qilgan bo'lsa backend 409
 * qaytaradi (chaqiruvchi `ApiError.status === 409` ni ushlab, "O'qilgan xabarni
 * tahrirlab bo'lmaydi" xabarini ko'rsatadi). Muvaffaqiyatda `editedAt` o'rnatiladi;
 * shu suhbat xabarlarini va ro'yxatni qayta so'raymiz.
 */
export function useEditMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      messageId,
      text,
    }: {
      conversationId: string;
      messageId: string;
      text: string;
    }) => api.patch<ChatMessage>(`/chat/conversations/${conversationId}/messages/${messageId}`, { text }),
    onSuccess: (_message, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'messages', variables.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

/**
 * Suhbatni arxivlaydi/arxivdan chiqaradi:
 * PATCH /chat/conversations/:id/archive { archived }
 * Asosiy (archived=false) va "Arxiv" (archived=true) ro'yxatlari — ikkalasi ham
 * yangilanishi kerak, shuning uchun `['chat','conversations']` prefiksini
 * invalidatsiya qilamiz.
 */
export function useArchiveConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.patch<{ ok: boolean }>(`/chat/conversations/${id}/archive`, { archived }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

/**
 * Suhbatni tozalaydi: DELETE /chat/conversations/:id/messages
 * Barcha xabarlarni o'chiradi VA suhbatni avtomatik arxivlaydi. `group-all` uchun
 * backend 400 qaytaradi (UI'da bu amal umumiy chat uchun ko'rsatilmaydi).
 */
export function useClearConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/chat/conversations/${id}/messages`),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'messages', id] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

/**
 * Suhbatni o'chiradi: DELETE /chat/conversations/:id (suhbat + barcha xabarlar).
 * `group-all` uchun backend 400 qaytaradi (UI'da ko'rsatilmaydi). Faol suhbat
 * o'chirilsa — ChatPage `activeId`ni tozalaydi.
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/chat/conversations/${id}`),
    onSuccess: () => {
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
