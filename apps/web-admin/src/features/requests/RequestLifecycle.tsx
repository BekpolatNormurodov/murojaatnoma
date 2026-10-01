import { useEffect, useRef, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DocumentText,
  UserTick,
  Activity,
  TickCircle,
  Star1,
  CloseCircle,
  Send2,
  Messages2,
  RotateLeft,
  ExportSquare,
} from 'iconsax-react';
import { api } from '@/shared/api/client';
import type { CitizenRequest } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';
import { formatDateTime } from '@/shared/lib/format';
import { Skeleton } from '@/shared/ui/Skeleton';
import { YANDEX_TILE_URL } from '@/features/map/mapShared';
import type { RequestEvent } from './useRequestEvents';

/* ─────────────────────────── Jarayon bosqichlari ─────────────────────────── */

interface Step {
  key: string;
  label: string;
  Icon: typeof DocumentText;
  at: string | null;
  done: boolean;
  tone?: 'danger';
}

/**
 * Murojaat hayot sikli: Qabul qilindi → Biriktirildi → Jarayonda → Hal qilindi
 * → Baholandi (rad etilsa: … → Rad etildi). Har bosqich vaqti `events`dan
 * (bo'lmasa murojaat maydonlaridan) olinadi.
 */
export function RequestProgress({
  request: r,
  events,
}: {
  request: CitizenRequest;
  events: RequestEvent[] | undefined;
}) {
  const ev = events ?? [];
  const firstAt = (pred: (e: RequestEvent) => boolean) => ev.find(pred)?.createdAt ?? null;
  const lastAt = (pred: (e: RequestEvent) => boolean) =>
    [...ev].reverse().find(pred)?.createdAt ?? null;
  const toStatus = (s: string) => (e: RequestEvent) =>
    e.type === 'STATUS_CHANGED' && (e.toStatus ?? '').toLowerCase() === s;

  const assigned = !!r.assignedWorkerId || ev.some((e) => e.type === 'ASSIGNED');
  const working = r.status === 'in_progress' || r.status === 'resolved';
  const reopenedAt = lastAt((e) => e.type === 'REOPENED');

  const steps: Step[] = [
    { key: 'created', label: 'Qabul qilindi', Icon: DocumentText, at: r.createdAt, done: true },
    {
      key: 'assigned',
      label: 'Biriktirildi',
      Icon: UserTick,
      at: lastAt((e) => e.type === 'ASSIGNED'),
      done: assigned,
    },
  ];
  if (r.status === 'rejected') {
    steps.push({
      key: 'rejected',
      label: 'Rad etildi',
      Icon: CloseCircle,
      at: lastAt(toStatus('rejected')),
      done: true,
      tone: 'danger',
    });
  } else {
    steps.push(
      {
        key: 'progress',
        label: 'Jarayonda',
        Icon: Activity,
        at: firstAt(toStatus('in_progress')),
        done: working,
      },
      {
        key: 'resolved',
        label: 'Hal qilindi',
        Icon: TickCircle,
        at: r.resolvedAt ?? lastAt(toStatus('resolved')),
        done: r.status === 'resolved',
      },
    );
    if (r.source === 'citizen') {
      steps.push({
        key: 'rated',
        label: 'Baholandi',
        Icon: Star1,
        at: lastAt((e) => e.type === 'RATED'),
        done: r.feedback != null,
      });
    }
  }
  const current = steps.reduce((acc, s, i) => (s.done ? i : acc), 0);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">Jarayon</p>
        {reopenedAt && r.status !== 'resolved' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            <RotateLeft size={12} /> Qayta ochilgan
          </span>
        )}
      </div>
      <ol className="flex">
        {steps.map((s, i) => {
          const color = s.tone === 'danger' ? '#ef4444' : s.done ? '#10b981' : undefined;
          const isCurrent = i === current && !(s.key === 'rated' && s.done) && r.status !== 'resolved';
          return (
            <li key={s.key} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-1/2 top-[15px] h-0.5 w-full',
                    s.done ? 'bg-primary-500' : 'bg-line',
                  )}
                  style={s.tone === 'danger' ? { background: '#ef4444' } : undefined}
                />
              )}
              <span
                className={cn(
                  'relative z-[1] flex h-8 w-8 items-center justify-center rounded-full border-2',
                  s.done ? 'text-white' : 'border-line bg-surface text-ink-muted',
                  isCurrent && 'ring-4 ring-primary-100',
                )}
                style={color ? { background: color, borderColor: color } : undefined}
              >
                <s.Icon size={15} variant={s.done ? 'Bold' : 'Linear'} />
              </span>
              <span
                className={cn(
                  'mt-1.5 text-[11px] font-semibold leading-tight',
                  s.done ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {s.label}
              </span>
              <span className="mt-0.5 px-0.5 text-[10px] leading-tight text-ink-muted">
                {s.done && s.at ? formatDateTime(s.at).replace(/ \d{4},/, ',') : '—'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─────────────────────────── Yozishmalar ─────────────────────────── */

interface ThreadMessage {
  id: string;
  senderRole: 'CITIZEN' | 'EMPLOYEE' | 'SYSTEM';
  senderName: string | null;
  text: string;
  attachmentUrl: string | null;
  createdAt: string;
}

/**
 * Fuqaro ↔ xodim yozishmasi (`/applications/:id/messages`). Admin ham shu
 * yerdan javob yoza oladi — xabar fuqaro ilovasida "Hokimiyat" nomidan chiqadi.
 */
export function RequestThread({ requestId, canWrite }: { requestId: string; canWrite: boolean }) {
  const qc = useQueryClient();
  const key = ['request-messages', requestId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<ThreadMessage[]>(`/applications/${requestId}/messages`),
    refetchInterval: 20_000,
  });
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: (body: string) =>
      api.post<ThreadMessage>(`/applications/${requestId}/messages`, {
        senderRole: 'EMPLOYEE',
        senderName: 'Hokimiyat',
        text: body,
      }),
    onSuccess: () => {
      setText('');
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const listRef = useRef<HTMLDivElement>(null);
  const count = q.data?.length ?? 0;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [count]);

  const submit = () => {
    const body = text.trim();
    if (body && !send.isPending) send.mutate(body);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Messages2 size={16} variant="Bulk" className="text-ink-muted" /> Yozishmalar
        {count > 0 && <span className="text-ink-muted">· {count}</span>}
      </p>
      <div ref={listRef} className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
        {q.isLoading ? (
          <>
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="ml-auto h-12 w-2/3" />
          </>
        ) : q.isError ? (
          <p className="py-3 text-center text-[12px] text-ink-muted">Yozishmalarni yuklab bo'lmadi</p>
        ) : count === 0 ? (
          <p className="py-3 text-center text-[12px] text-ink-muted">Hali xabar yo'q</p>
        ) : (
          q.data!.map((m) => {
            if (m.senderRole === 'SYSTEM') {
              return (
                <p key={m.id} className="text-center text-[11px] text-ink-muted">
                  {m.text} · {formatDateTime(m.createdAt)}
                </p>
              );
            }
            const mine = m.senderRole === 'EMPLOYEE';
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2',
                    mine ? 'rounded-br-md bg-primary-50' : 'rounded-bl-md bg-surface-2',
                  )}
                >
                  <p className="text-[11px] font-semibold text-ink-soft">
                    {m.senderName ?? (mine ? 'Xodim' : 'Fuqaro')}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-[13px] text-ink">{m.text}</p>
                  {m.attachmentUrl && (
                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1.5 block">
                      <img
                        src={m.attachmentUrl}
                        alt=""
                        loading="lazy"
                        className="max-h-40 rounded-lg border border-line object-cover"
                      />
                    </a>
                  )}
                  <p className="mt-0.5 text-right text-[10px] text-ink-muted">
                    {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      {canWrite && (
        <div className="mt-3 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={2}
            maxLength={2000}
            placeholder="Fuqaroga javob yozing…"
            className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-muted focus:border-primary-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || send.isPending}
            aria-label="Yuborish"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            <Send2 size={18} variant="Bold" />
          </button>
        </div>
      )}
      {send.isError && (
        <p role="alert" className="mt-1.5 text-[12px] text-danger">
          Xabar yuborilmadi — qayta urinib ko'ring.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────── Joylashuv ─────────────────────────── */

/** Kichik, statik xarita — murojaat nuqtasi (Yandex, EPSG:3395). */
export function LocationMiniMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="relative isolate mt-2.5 h-40 overflow-hidden rounded-xl border border-line">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        crs={L.CRS.EPSG3395}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={YANDEX_TILE_URL} />
        <CircleMarker
          center={[lat, lng]}
          radius={9}
          pathOptions={{ color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }}
        />
      </MapContainer>
      <a
        href={`https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map`}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 right-2 z-[1000] inline-flex items-center gap-1 rounded-lg border border-line bg-surface/95 px-2 py-1 text-[11px] font-semibold text-ink-soft shadow-sm hover:text-ink"
      >
        <ExportSquare size={12} /> Yandex xaritada
      </a>
    </div>
  );
}
