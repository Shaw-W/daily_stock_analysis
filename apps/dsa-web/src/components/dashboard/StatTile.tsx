import type React from 'react';
import { cn } from '../../utils/cn';

export type StatTileProps = {
  label: string;
  value: string | number;
  unit?: string;
  subLabel?: string;
  icon?: React.ReactNode;
  accent?: boolean;    // green highlight
  loading?: boolean;
  className?: string;
};

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  unit,
  subLabel,
  icon,
  accent = false,
  loading = false,
  className,
}) => {
  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2 rounded-lg border border-border bg-card p-4', className)}>
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-border bg-card p-4',
        'transition-colors hover:bg-hover/40',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {icon && (
          <span className="text-muted-foreground/60 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <p
          className={cn(
            'text-[1.75rem] font-bold tabular-nums leading-none',
            accent ? 'text-[var(--data-positive)]' : 'text-foreground'
          )}
        >
          {value}
        </p>
        {unit && <span className="text-[12px] text-muted-foreground">{unit}</span>}
      </div>
      {subLabel && (
        <p className="text-[11px] text-muted-foreground">{subLabel}</p>
      )}
    </div>
  );
};
