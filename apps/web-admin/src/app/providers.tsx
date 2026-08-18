import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';
import { I18nProvider } from '@/shared/i18n/I18nProvider';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { CallProvider } from '@/shared/realtime/CallProvider';
import { CallOverlay } from '@/shared/ui/CallOverlay';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={client}>
          <RealtimeProvider>
            <CallProvider>
              {children}
              <CallOverlay />
            </CallProvider>
          </RealtimeProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
