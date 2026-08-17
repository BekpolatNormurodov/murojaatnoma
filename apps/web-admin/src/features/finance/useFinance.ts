import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { FinanceMonthly, UtilityMonthly, UtilityPayment } from '@/shared/data/types';

/**
 * Oylik moliyaviy aylanma (byudjet / sarflangan / yig'ilgan): GET /api/finance/monthly
 * Javob shakli mock'dagi `FINANCE_MONTHLY: FinanceMonthly[]` bilan bir xil (drop-in).
 */
export function useFinanceMonthly() {
  return useQuery({
    queryKey: ['finance', 'monthly'],
    queryFn: () => api.get<FinanceMonthly[]>('/finance/monthly'),
    staleTime: 60_000,
  });
}

/**
 * Kommunal to'lovlar — tuman × tur kesimida: GET /api/utility/payments
 * Javob shakli mock'dagi `UTILITY_PAYMENTS: UtilityPayment[]` bilan bir xil (drop-in).
 */
export function useUtilityPayments() {
  return useQuery({
    queryKey: ['utility', 'payments'],
    queryFn: () => api.get<UtilityPayment[]>('/utility/payments'),
    staleTime: 60_000,
  });
}

/**
 * Oylik kommunal to'lovlar tarkibi (tur bo'yicha): GET /api/utility/monthly
 * Javob shakli mock'dagi `UTILITY_MONTHLY: UtilityMonthly[]` bilan bir xil (drop-in).
 */
export function useUtilityMonthly() {
  return useQuery({
    queryKey: ['utility', 'monthly'],
    queryFn: () => api.get<UtilityMonthly[]>('/utility/monthly'),
    staleTime: 60_000,
  });
}
