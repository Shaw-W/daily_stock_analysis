import type React from 'react';
import { cn } from '../../utils/cn';

export type HealthBarItem = {
  key: string;
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'error' | 'unknown';
};

type HealthBarProps = {
  items: HealthBarItem[];
  className?: string;
};

const STATUS_DOT: Record<HealthBarItem['status'], string> = {
  ok:      'bg-[var(--data-positive)]',
  warn:    'bg-[var(--data-warning)] animate-pulse',
  error:   'bg-[var(--data-danger)] animate-pulse',
  unknown: 'bg-muted-foreground/40',
};

const STATUS_TEXT: Record<HealthBarItem['status'], string> = {
  ok:      'text-[var(--data-positive)]',
  warn:    'text-[var(--data-warning)]',
  error:   'text-[var(--data-danger)]',
  unknown: 'text-muted-foreground',
};

export const HealthBar: React.FC<HealthBarProps> = ({ items, className }) => (
  <div
    className={cn(
      'flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border/50 px-4 py-2',
      'bg-card/50 text-[12px]',
      className
    )}
  >
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-positive)]" />
      性能健康
    </span>
    {items.map((item) => (
      <span key={item.key} className="flex items-center gap-1">
        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[item.status])} />
        <span className="text-muted-foreground">{item.label}</span>
        <span className={cn('font-medium tabular-nums', STATUS_TEXT[item.status])}>
          {item.value}
        </span>
      </span>
    ))}
  </div>
);
