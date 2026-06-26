import { Link } from 'react-router-dom';
import React from 'react';

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;
  
  return (
    <nav className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.label}>
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-blue-600 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-slate-700' : ''}>{item.label}</span>
            )}
            {!isLast && <span className="text-slate-300 mx-1">/</span>}
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
    <div className="mb-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {icon && (
            <div className="h-12 w-12 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold ring-4 ring-slate-50">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight truncate">{title}</h1>
            {description && <div className="text-sm text-slate-500 mt-1">{description}</div>}
          </div>
        </div>
        {rightContent && (
          <div className="shrink-0 flex items-center gap-4">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
}
