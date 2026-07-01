import { useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../api/endpoints';

type NotificationItem = {
  id: string;
  subject?: string | null;
  body?: string | null;
  app_number?: string | null;
  created_at?: string | null;
  status?: string | null;
};

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent ?? tmp.innerText ?? '').trim();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadUnreadCount = async () => {
    const { data } = await notificationsApi.unreadCount();
    setUnreadCount(Number(data.count || 0));
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.list();
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUnreadCount();
    const timer = window.setInterval(() => void loadUnreadCount(), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) {
      void loadItems();
    }
  }, [open]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setUnreadCount((current) => Math.max(0, current - 1));
    await loadItems();
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
    await loadItems();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-600 px-1.5 text-center text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Notifications</div>
              <div className="text-xs text-slate-500">{unreadCount} unread</div>
            </div>
            <button onClick={() => void markAllRead()} className="text-xs font-medium text-blue-700 hover:text-blue-900">
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && <div className="px-4 py-6 text-sm text-slate-500">Loading...</div>}
            {!loading && items.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">No notifications.</div>}
            {!loading &&
              items.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{item.subject || 'HRMS notification'}</div>
                      <div className="mt-1 text-xs text-slate-600">{item.body ? stripHtml(item.body) : 'No message body provided.'}</div>
                      {item.app_number && <div className="mt-1 text-xs text-slate-500">Application: {item.app_number}</div>}
                      <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.created_at)}</div>
                    </div>
                    {(item.status || '').toUpperCase() === 'PENDING' && (
                      <button onClick={() => void markRead(item.id)} className="text-xs font-medium text-blue-700 hover:text-blue-900">
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
