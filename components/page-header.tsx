import type { ReactNode } from "react";

interface PageHeaderProps {
  badge?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ badge, title, description, actions }: PageHeaderProps) {
  return (
    <div className="border-b border-[#21262d] bg-[#0d1117] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          {badge && <div className="flex flex-wrap items-center gap-2 mb-2">{badge}</div>}
          <h1 className="text-xl font-bold text-white tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-sm text-[#7d8590] mt-0.5">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
