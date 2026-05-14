import type React from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';

export type MetricCardStatus = 'online' | 'warning' | 'error' | 'offline' | 'neutral';

export type MetricCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { delta: number; direction: 'up' | 'down' | 'flat' };
  status?: MetricCardStatus;
  hint?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
};

const STATUS_DOT: Record<MetricCardStatus, string> = {
  online: 'bg-[var(--status-online)] shadow-[0_0_6px_var(--status-online)]',
  warning: 'bg-[var(--status-warning)] shadow-[0_0_6px_var(--status-warning)] animate-pulse',
  error: 'bg-[var(--status-error)] shadow-[0_0_6px_var(--status-error)] animate-pulse',
  offline: 'bg-[var(--status-offline)]',
  neutral: 'bg-muted-foreground/40',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  trend,
  status,
  hint,
  loading = false,
  icon,
  className,
}) => {
  if (loading) {
    return (
      <div
        className={cn(
          'flex flex-col gap-2 rounded-[var(--metric-card-radius)] border border-[var(--metric-card-border)] bg-[var(--metric-card-bg)] p-4',
          className
        )}
      >
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-[var(--metric-card-radius)] border border-[var(--metric-card-border)] bg-[var(--metric-card-bg)] p-4',
        'transition-all duration-150 hover:border-[var(--accent-ai-border)] hover:shadow-[0_0_20px_var(--accent-ai-glow)]',
        className
      )}
      aria-label={hint}
    >
      {/* Status dot */}
      {status && status !== 'neutral' && (
        <span
          className={cn('absolute right-3 top-3 h-1.5 w-1.5 rounded-full', STATUS_DOT[status])}
        />
      )}

      {/* Icon + label row */}
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className="text-[var(--accent-ai)] opacity-70 [&>svg]:h-3.5 [&>svg]:w-3.5">
            {icon}
          </span>
        )}
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-semibold tabular-nums text-foreground leading-none">{value}</p>
        {unit && (
          <span className="text-[11px] text-muted-foreground">{unit}</span>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div
          className={cn(
            'flex items-center gap-1 text-[11px] tabular-nums',
            trend.direction === 'up' && 'text-[var(--market-up)]',
            trend.direction === 'down' && 'text-[var(--market-down)]',
            trend.direction === 'flat' && 'text-muted-foreground'
          )}
        >
          {trend.direction === 'up' && <TrendingUp className="h-3 w-3" />}
          {trend.direction === 'down' && <TrendingDown className="h-3 w-3" />}
          {trend.direction === 'flat' && <Minus className="h-3 w-3" />}
          <span>{trend.delta > 0 ? '+' : ''}{trend.delta}</span>
        </div>
      )}
    </div>
  );
};
