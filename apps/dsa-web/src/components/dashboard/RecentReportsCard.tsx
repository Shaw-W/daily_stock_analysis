import type React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { cn } from '../../utils/cn';

export type RecentReport = {
  id: number;
  stockCode: string;
  stockName: string;
  createdAt: string;
  recommendation?: string;
  risk?: 'low' | 'mid' | 'high';
  reportType?: string;
};

type RecentReportsCardProps = {
  reports: RecentReport[];
  loading?: boolean;
  onView: (id: number) => void;
  className?: string;
};

const RISK_CLS: Record<string, string> = {
  low: 'text-[var(--status-online)]',
  mid: 'text-[var(--status-warning)]',
  high: 'text-[var(--status-error)]',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export const RecentReportsCard: React.FC<RecentReportsCardProps> = ({
  reports,
  loading = false,
  onView,
  className,
}) => (
  <div
    className={cn(
      'rounded-[var(--metric-card-radius)] border border-[var(--metric-card-border)] bg-[var(--metric-card-bg)] p-4',
      className
    )}
  >
    <p className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">最近报告</p>

    {loading ? (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/30" />
        ))}
      </div>
    ) : reports.length === 0 ? (
      <div className="flex flex-col items-center py-6 text-center">
        <FileText className="mb-1.5 h-6 w-6 text-muted-foreground/30" />
        <p className="text-[12px] text-muted-foreground">暂无报告</p>
      </div>
    ) : (
      <div className="space-y-1.5">
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onView(r.id)}
            className={cn(
              'group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left',
              'border border-transparent transition-all',
              'hover:border-[var(--accent-ai-border)] hover:bg-[var(--accent-ai-soft)]'
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-[var(--accent-ai)]" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium tabular-nums text-foreground">
                  {r.stockCode}
                  <span className="ml-1 font-normal text-muted-foreground">{r.stockName}</span>
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground/70">
                  {formatTime(r.createdAt)}
                  {r.risk && (
                    <span className={cn('ml-1.5 font-medium', RISK_CLS[r.risk] ?? '')}>
                      {r.risk === 'low' ? '低风险' : r.risk === 'mid' ? '中风险' : '高风险'}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-[var(--accent-ai)]" />
          </button>
        ))}
      </div>
    )}
  </div>
);
