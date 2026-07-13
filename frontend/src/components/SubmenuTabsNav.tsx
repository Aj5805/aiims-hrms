import { Link, useLocation } from 'react-router-dom';
import type { NavTab } from '../config/navSections';
import { isTabActive } from '../config/navSections';

type Props = {
  tabs: NavTab[];
  ariaLabel: string;
  className?: string;
};

export function SubmenuTabsNav({ tabs, ariaLabel, className = '' }: Props) {
  const location = useLocation();

  if (tabs.length <= 1) return null;

  return (
    <nav
      className={`submenu-tabs flex flex-nowrap gap-0.5 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm ${className}`}
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = isTabActive(tab, location);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
