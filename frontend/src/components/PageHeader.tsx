import { Link } from 'react-router-dom';
import React from 'react';

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs font-medium text-slate-400 mb-3">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.label}>
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-indigo-600 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-slate-600 font-semibold' : ''}>{item.label}</span>
            )}
            {!isLast && <span className="text-slate-300 select-none">/</span>}
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
  rightContent
}: {
  breadcrumbs?: BreadcrumbItem[];
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="h-10 w-10 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold border border-indigo-100">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight truncate">{title}</h1>
            {description && <div className="text-sm text-slate-500 mt-0.5">{description}</div>}
          </div>
        </div>
        {rightContent && (
          <div className="shrink-0 flex items-center gap-3">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}
