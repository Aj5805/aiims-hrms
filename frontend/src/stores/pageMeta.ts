import { create } from 'zustand';
import type { BreadcrumbItem } from '../components/PageHeader';

let formMessageTimer: ReturnType<typeof setTimeout> | undefined;

interface PageMetaState {
  breadcrumbs: BreadcrumbItem[];
  formMessage: string | null;
  setBreadcrumbs: (items: BreadcrumbItem[]) => void;
  setFormMessage: (message: string | null, autoClearMs?: number) => void;
  clear: () => void;
}

export const usePageMetaStore = create<PageMetaState>((set) => ({
  breadcrumbs: [],
  formMessage: null,
  setBreadcrumbs: (items) => set({ breadcrumbs: items }),
  setFormMessage: (message, autoClearMs = 4000) => {
    if (formMessageTimer) clearTimeout(formMessageTimer);
    set({ formMessage: message });
    if (message && autoClearMs > 0) {
      formMessageTimer = setTimeout(() => {
        set({ formMessage: null });
        formMessageTimer = undefined;
      }, autoClearMs);
    }
  },
  clear: () => {
    if (formMessageTimer) clearTimeout(formMessageTimer);
    formMessageTimer = undefined;
    set({ breadcrumbs: [], formMessage: null });
  },
}));
