import { useEffect, useMemo, useState } from 'react';
import { systemApi } from '../api/endpoints';

/** Live server clock — syncs with backend every minute, ticks every second. */
export function ServerClock() {
  const [offsetMs, setOffsetMs] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const { data } = await systemApi.time();
        const serverMs =
          typeof data.unix_ms === 'number'
            ? data.unix_ms
            : new Date(String(data.server_time)).getTime();
        if (!cancelled && !Number.isNaN(serverMs)) {
          setOffsetMs(serverMs - Date.now());
        }
      } catch {
        /* keep last offset */
      }
    };

    void sync();
    const syncInterval = window.setInterval(() => void sync(), 60_000);
    const tickInterval = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(syncInterval);
      window.clearInterval(tickInterval);
    };
  }, []);

  const { label, iso } = useMemo(() => {
    const now = new Date(Date.now() + offsetMs);
    return {
      iso: now.toISOString(),
      label: new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now),
    };
  }, [offsetMs, tick]);

  return (
    <time
      dateTime={iso}
      className="hidden lg:block text-[11px] text-slate-500 tabular-nums whitespace-nowrap border border-slate-200 bg-white/80 rounded-md px-2 py-0.5"
      title="Server date & time"
    >
      {label}
    </time>
  );
}
