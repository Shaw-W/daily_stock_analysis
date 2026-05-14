import type React from 'react';
import { BarChart3, Eye, MessageSquareQuote } from 'lucide-react';
import { cn } from '../../utils/cn';

export type WatchlistRow = {
  code: string;
  name: string;
  market?: 'CN' | 'HK' | 'US' | string;
  price?: number;
  change?: number;
  aiScore?: number;
  trend?: 'up' | 'down' | 'flat';
  risk?: 'low' | 'mid' | 'high';
  reportId?: number;
  createdAt?: string;
};

type WatchlistTableProps = {
  rows: WatchlistRow[];
  loading?: boolean;
  onAnalyze?: (code: string) => void;
  onAskAgent?: (code: string, name: string) => void;
  onViewReport?: (id: number) => void;
  className?: string;
};

const MARKET_BADGE: Record<string, string> = {
  CN: 'bg-red-500/10 text-red-400',
  HK: 'bg-orange-500/10 text-orange-400',
  US: 'bg-blue-500/10 text-blue-400',
};

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  low: { label: '低风险', cls: 'text-[var(--status-online)] bg-[var(--status-online)]/10' },
  mid: { label: '中风险', cls: 'text-[var(--status-warning)] bg-[var(--status-warning)]/10' },
  high: { label: '高风险', cls: 'text-[var(--status-error)] bg-[var(--status-error)]/10' },
};

export const WatchlistTable: React.FC<WatchlistTableProps> = ({
  rows,
  loading = false,
  onAnalyze,
  onAskAgent,
  onViewReport,
  className,
}) => {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/30" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center', className)}>
        <BarChart3 className="mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">暂无自选股</p>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          分析股票后将自动汇聚到这里
        </p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-[var(--table-border)]', className)}>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--table-border)] bg-muted/20">
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              股票
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
              AI 评分
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              风险
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const marketCls = MARKET_BADGE[row.market ?? ''] ?? 'bg-muted/20 text-muted-foreground';
            const riskInfo = row.risk ? RISK_BADGE[row.risk] : null;

            return (
              <tr
                key={`${row.code}-${idx}`}
                className="border-b border-[var(--table-border)] transition-colors hover:bg-[var(--table-row-hover)] last:border-0"
              >
                {/* Stock code + name */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                        marketCls
                      )}
                    >
                      {row.market ?? '--'}
                    </span>
                    <div>
                      <p className="font-medium tabular-nums text-foreground">{row.code}</p>
                      <p className="text-[11px] text-muted-foreground">{row.name}</p>
                    </div>
                  </div>
                </td>

                {/* AI score */}
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {row.aiScore != null ? (
                    <span
                      className={cn(
                        'font-semibold',
                        row.aiScore >= 70 && 'text-[var(--status-online)]',
                        row.aiScore >= 40 && row.aiScore < 70 && 'text-[var(--accent-ai)]',
                        row.aiScore < 40 && 'text-[var(--status-error)]'
                      )}
                    >
                      {row.aiScore}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">--</span>
                  )}
                </td>

                {/* Risk badge */}
                <td className="px-3 py-2.5">
                  {riskInfo ? (
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', riskInfo.cls)}>
                      {riskInfo.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">--</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {onViewReport && row.reportId != null && (
                      <button
                        type="button"
                        onClick={() => onViewReport(row.reportId!)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-[var(--accent-ai-soft)] hover:text-[var(--accent-ai)]"
                        aria-label="查看报告"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onAskAgent && (
                      <button
                        type="button"
                        onClick={() => onAskAgent(row.code, row.name)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-[var(--accent-ai-soft)] hover:text-[var(--accent-ai)]"
                        aria-label="Agent 问股"
                      >
                        <MessageSquareQuote className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onAnalyze && (
                      <button
                        type="button"
                        onClick={() => onAnalyze(row.code)}
                        className="rounded border border-[var(--accent-ai-border)] bg-[var(--accent-ai-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-ai)] transition-colors hover:bg-[var(--accent-ai-soft)]"
                      >
                        分析
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
