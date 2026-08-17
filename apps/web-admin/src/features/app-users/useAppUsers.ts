import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { AppUser, AppUserStatus, Paginated } from './api/types';

const LIST_KEY = ['app-users', 'list'] as const;

/**
 * Ilova foydalanuvchilari ro'yxatini backend'dan oladi: GET /api/app-users
 *
 * Sahifadagi qidiruv/filtr/saralash hammasi klient tomonda ishlaydi (mock
 * davridagi kabi), shuning uchun bitta so'rovda backend ruxsat bergan
 * maksimal `limit=100` bilan to'liq ro'yxatni olamiz.
 */
export function useAppUsers() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => api.get<Paginated<AppUser>>('/app-users?limit=100'),
    staleTime: 30_000,
  });
}

/** `PATCH /app-users/:id` ga yuboriladigan admin moderatsiya maydonlari. */
export interface UpdateAppUserInput {
  status?: AppUserStatus;
  verified?: boolean;
  notificationsOn?: boolean;
}

/**
 * Admin moderatsiyasi: bloklash/faollashtirish (`status`), shaxsni
 * tasdiqlash (`verified`) yoki bildirishnomalarni o'zgartirish
 * (`notificationsOn`) — PATCH /api/app-users/:id.
 *
 * Ro'yxat keshi (`['app-users', 'list']`) darhol (optimistik) yangilanadi,
 * shuning uchun sahifa va profil drawer'i bir zumda javob beradi; xato
 * bo'lsa avvalgi ro'yxat holatiga qaytariladi. Muvaffaqiyatli bo'lsa,
 * umumiy statistika (`stats`) ham backend'dan qayta so'raladi — chunki
 * faol/bloklangan/tasdiqlangan sonlari shu yerda agregatsiya qilinadi.
 */
export function useUpdateAppUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateAppUserInput & { id: string }) =>
      api.patch<AppUser>(`/app-users/${id}`, patch),

    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: LIST_KEY });
      const prevList = queryClient.getQueryData<Paginated<AppUser>>(LIST_KEY);
      if (prevList) {
        queryClient.setQueryData<Paginated<AppUser>>(LIST_KEY, {
          ...prevList,
          data: prevList.data.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        });
      }
      return { prevList };
    },

    onError: (_err, _vars, context) => {
      if (context?.prevList) {
        queryClient.setQueryData(LIST_KEY, context.prevList);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-users', 'stats'] });
    },
  });
}
