import { create } from 'zustand';

export type ToastKind = 'success' | 'error';

export type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastState = {
  toasts: Toast[];
  showSuccess: (message?: string) => void;
  showError: (message: string) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;
const AUTO_DISMISS_MS = 3500;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showSuccess: (message = 'Saved successfully.') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind: 'success', message }] }));
    window.setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  showError: (message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind: 'error', message }] }));
    window.setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS + 1000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
