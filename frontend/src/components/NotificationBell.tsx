import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { resolveNotificationNavigation } from '../utils/notificationNavigation';
import { canToggleWorkMode } from '../utils/workMode';

type NotificationItem = {
  id: string;
  application_id?: string | null;
  subject?: string | null;
  body?: string | null;
  app_number?: string | null;
  created_at?: string | null;
  status?: string | null;
};

function formatWhen(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function NotificationBell() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const employeeId = useAuthStore((s) => s.user?.employee_id ?? null);
  const role = useAuthStore((s) => s.user?.role ?? '');
  const token = useAuthStore((s) => s.token);
  const setWorkMode = useAuthStore((s) => s.setWorkMode);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
    if (!userId || !token) {
      setUnreadCount(0);
      setItems([]);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const { data } = await notificationsApi.unreadCount();
        if (!cancelled) setUnreadCount(Number(data.count || 0));
      } catch {
        if (!cancelled) setUnreadCount(0);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [userId, token]);

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

  const openApplication = async (item: NotificationItem) => {
    const target = resolveNotificationNavigation(item, role);
    if (!target) return;

    if ((item.status || '').toUpperCase() === 'PENDING') {
      await markRead(item.id);
    }

    setOpen(false);

    if (canToggleWorkMode(role, employeeId)) {
      setWorkMode(target.workMode);
    }

    navigate(target.path);
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
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Notifications</div>
              <div className="text-xs text-slate-500">{unreadCount} unread</div>
            </div>
            <button onClick={() => void markAllRead()} className="text-xs font-medium text-blue-700 hover:text-blue-900">
              Mark all read
            </button>
          </div>

          <div className="max-h-96 app-scroll-y">
            {loading && <div className="px-4 py-6 text-sm text-slate-500">Loading...</div>}
            {!loading && items.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">No notifications.</div>}
            {!loading &&
              items.map((item) => (
                <div key={item.id} className="border-b border-slate-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => void openApplication(item)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {item.subject || 'HRMS notification'}
                        </div>
                        {item.app_number && (
                          <div className="mt-0.5 text-xs text-slate-500">{item.app_number}</div>
                        )}
                        <div className="mt-1 text-[11px] text-slate-400">{formatWhen(item.created_at)}</div>
                      </div>
                      {(item.status || '').toUpperCase() === 'PENDING' && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1.5" title="Unread" />
                      )}
                    </div>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
