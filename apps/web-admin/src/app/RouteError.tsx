import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { CloseCircle, Home2, RotateRight } from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';

/**
 * Route-level error boundary. A page that throws while rendering no longer
 * replaces the whole app with React Router's developer screen — the sidebar
 * stays and the page area shows what happened plus a way out.
 */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();
  const isChunk =
    error instanceof Error && /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error ?? '');

  if (import.meta.env.DEV) console.error(error);

  return (
    <Card className="mx-auto mt-6 flex max-w-lg flex-col items-center gap-3 p-10 text-center">
      <CloseCircle size={44} variant="Bulk" className="text-danger" />
      <div>
        <p className="text-[15px] font-semibold text-ink">
          {isChunk ? 'Ilovaning yangi versiyasi chiqdi' : "Sahifani ko'rsatishda xatolik yuz berdi"}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {isChunk
            ? "Sahifani yangilang — yangi versiya yuklanadi."
            : "Ma'lumotlaringiz saqlangan. Sahifani qayta yuklab ko'ring; takrorlansa, administratorga xabar bering."}
        </p>
        {!isChunk && detail && (
          <p className="mt-3 break-words rounded-lg bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-ink-muted">{detail}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>
          <RotateRight size={16} /> Qayta yuklash
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          <Home2 size={16} /> Bosh sahifa
        </Button>
      </div>
    </Card>
  );
}
