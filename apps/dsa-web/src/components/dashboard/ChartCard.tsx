import type React from 'react';
import { cn } from '../../utils/cn';

type ChartTab = { key: string; label: string };

type ChartCardProps = {
  title: string;
  subtitle?: string;
  total?: string | number;
  tabs?: ChartTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  children: React.ReactNode;
  className?: string;
};

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  total,
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
}) => (
  <div className={cn('rounded-lg border border-border bg-card', className)}>
    {/* Header */}
    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-[13px] font-medium text-foreground">{title}</p>
            {total != null && (
              <span className="text-[13px] tabular-nums text-muted-foreground">{total}</span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {/* Tab switchers */}
      {tabs && tabs.length > 0 && (
        <div className="flex shrink-0 items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange?.(tab.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] transition-colors',
                activeTab === tab.key
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-hover hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
    {/* Chart content */}
    <div className="p-4">{children}</div>
  </div>
);
