import { useMemo, useState } from 'react';
import { SearchNormal1 } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Avatar } from '@/shared/ui/Avatar';
import type { LiveLocation } from '@/shared/api/locations';
import { useLiveEmployees } from './useChat';
import { pickAvatarColor } from './chatAvatar';

/**
 * "Xodimga yozish" — umumiy chat sahifasidan yangi DM boshlash uchun
 * qidiriladigan xodimlar ro'yxati. Ro'yxat xarita ishlatadigan aynan o'sha
 * jonli manbadan (`GET /locations/latest`) keladi — mock/soxta ma'lumot yo'q.
 * Xodim tanlanganda `onSelect` chaqiriladi; navigatsiya (`/chat?to=<id>`)
 * chaqiruvchi (`ChatPage`) tomonidan amalga oshiriladi.
 */
export function EmployeePickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (employee: LiveLocation) => void;
}) {
  const [query, setQuery] = useState('');
  const employeesQuery = useLiveEmployees();
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const filtered = useMemo(() => {
    const sorted = [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName, 'uz'));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) => `${e.fullName} ${e.position ?? ''}`.toLowerCase().includes(q));
  }, [employees, query]);

  function handleSelect(employee: LiveLocation) {
    setQuery('');
    onSelect(employee);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xodimga yozish"
      subtitle="Suhbat boshlash uchun xodimni tanlang"
      width={420}
    >
      <div className="relative mb-3">
        <SearchNormal1
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Xodim qidirish…"
          className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm outline-none focus:border-primary-300"
        />
      </div>

      <div className="max-h-80 space-y-1 overflow-y-auto">
        {employeesQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Yuklanmoqda…</p>
        ) : employeesQuery.isError ? (
          <p className="py-8 text-center text-sm text-ink-muted">Xodimlar ro'yxatini yuklab bo'lmadi</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Xodim topilmadi</p>
        ) : (
          filtered.map((e) => (
            <button
              key={e.employeeId}
              onClick={() => handleSelect(e)}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <Avatar
                name={e.fullName}
                src={e.avatarUrl ?? undefined}
                color={pickAvatarColor(e.employeeId)}
                size={38}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{e.fullName}</span>
                <span className="block truncate text-xs text-ink-muted">{e.position || '—'}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
