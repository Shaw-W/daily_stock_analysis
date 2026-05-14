import type React from 'react';
import { cn } from '../../utils/cn';

export type PageTab = {
  key: string;
  label: string;
  count?: number;
};

type PageTabsProps = {
  tabs: PageTab[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
};

export const PageTabs: React.FC<PageTabsProps> = ({
  tabs,
  activeKey,
  onChange,
  className,
}) => (
  <div className={cn('flex items-center gap-1 border-b border-border/60', className)}>
    {tabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        onClick={() => onChange(tab.key)}
        className={cn(
          'relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium transition-colors',
          activeKey === tab.key
            ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {tab.label}
        {tab.count != null && (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[11px] tabular-nums',
              activeKey === tab.key
                ? 'bg-foreground/10 text-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);
