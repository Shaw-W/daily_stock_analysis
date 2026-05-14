import type React from 'react';
import { Activity, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export type HealthStatus = 'online' | 'warning' | 'error' | 'unknown';

export type HealthItem = {
  key: string;
  label: string;
  status: HealthStatus;
  hint?: string;
  ctaHref?: string;
};

type DataSourceHealthCardProps = {
  items: HealthItem[];
  loading?: boolean;
  className?: string;
};

const STATUS_ICON: Record<HealthStatus, React.ReactNode> = {
  online: <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-online)]" />,
  warning: <AlertCircle className="h-3.5 w-3.5 text-[var(--status-warning)]" />,
  error: <XCircle className="h-3.5 w-3.5 text-[var(--status-error)]" />,
  unknown: <Activity className="h-3.5 w-3.5 text-muted-foreground/40" />,
};

const STATUS_TEXT: Record<HealthStatus, string> = {
  online: 'text-[var(--status-online)]',
  warning: 'text-[var(--status-warning)]',
  error: 'text-[var(--status-error)]',
  unknown: 'text-muted-foreground/40',
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  online: '正常',
  warning: '需配置',
  error: '异常',
  unknown: '未知',
};

export const DataSourceHealthCard: React.FC<DataSourceHealthCardProps> = ({
  items,
  loading = false,
  className,
}) => (
  <div
    className={cn(
      'rounded-[var(--metric-card-radius)] border border-[var(--metric-card-border)] bg-[var(--metric-card-bg)] p-4',
      className
    )}
  >
    <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">系统健康</p>

    {loading ? (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted/30" />
        ))}
      </div>
    ) : items.length === 0 ? (
      <p className="text-[12px] text-muted-foreground">暂无配置数据</p>
    ) : (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-2"
            aria-label={item.hint}
          >
            <div className="flex min-w-0 items-center gap-2">
              {STATUS_ICON[item.status]}
              <span className="truncate text-[12px] text-foreground/80">{item.label}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className={cn('text-[11px] font-medium tabular-nums', STATUS_TEXT[item.status])}>
                {STATUS_LABEL[item.status]}
              </span>
              {(item.status === 'warning' || item.status === 'error') && item.ctaHref && (
                <a
                  href={item.ctaHref}
                  className="text-[10px] text-[var(--accent-ai)] hover:underline"
                >
                  去配置
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
