import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePageMetaStore } from '../stores/pageMeta';

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items, className = '' }: { items: BreadcrumbItem[]; className?: string }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className={`flex items-center flex-wrap gap-1 text-xs font-medium text-slate-400 min-w-0 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-indigo-600 transition-colors truncate max-w-[8rem] sm:max-w-none">
                {item.label}
              </Link>
            ) : (
              <span className={`truncate max-w-[10rem] sm:max-w-xs ${isLast ? 'text-slate-600 font-semibold' : ''}`}>
                {item.label}
              </span>
            )}
            {!isLast && <span className="text-slate-300 select-none shrink-0">/</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  icon,
  rightContent,
  hideTitle = false,
}: {
  breadcrumbs?: BreadcrumbItem[];
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
  /** When true, only registers breadcrumbs (no in-page title block). */
  hideTitle?: boolean;
}) {
  const setBreadcrumbs = usePageMetaStore((s) => s.setBreadcrumbs);
  const clear = usePageMetaStore((s) => s.clear);
  const formMessage = usePageMetaStore((s) => s.formMessage);

  useEffect(() => {
    setBreadcrumbs(breadcrumbs ?? []);
    return () => clear();
  }, [breadcrumbs, setBreadcrumbs, clear]);

  const showTitleBlock = !hideTitle && (title || description || rightContent || icon);

  return (
    <>
      {showTitleBlock && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="h-9 w-9 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold border border-indigo-100">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight truncate">{title}</h1>
              )}
              {description && <div className="text-sm text-slate-500 mt-0.5">{description}</div>}
            </div>
          </div>
          {rightContent && (
            <div className="shrink-0 flex items-center gap-3">
              {rightContent}
            </div>
          )}
        </div>
      )}
      {formMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900" role="status">
          {formMessage}
        </div>
      )}
    </>
  );
}
