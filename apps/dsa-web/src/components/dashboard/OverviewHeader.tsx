import type React from 'react';
import { Clock, Radio } from 'lucide-react';
import { cn } from '../../utils/cn';

type RunMode = 'live' | 'manual' | 'scheduled';

const MODE_LABEL: Record<RunMode, { label: string; color: string }> = {
  live: { label: '实时推送', color: 'text-[var(--status-online)]' },
  manual: { label: '手动模式', color: 'text-muted-foreground' },
  scheduled: { label: '定时任务', color: 'text-[var(--accent-ai)]' },
};

type OverviewHeaderProps = {
  title?: string;
  subtitle?: string;
  lastAnalysisAt?: string | null;
  runMode?: RunMode;
  rightSlot?: React.ReactNode;
  className?: string;
};

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '暂无记录';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export const OverviewHeader: React.FC<OverviewHeaderProps> = ({
  title = 'AI 股票投研工作台',
  subtitle = 'A/H/美股智能分析 · 报告 · Agent 问股 · 任务监控',
  lastAnalysisAt,
  runMode = 'manual',
  rightSlot,
  className,
}) => {
  const mode = MODE_LABEL[runMode];

  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        {/* Title */}
        <h1 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {title}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>最近分析：{formatRelativeTime(lastAnalysisAt)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Radio className="h-3 w-3" />
            <span className={mode.color}>{mode.label}</span>
          </span>
          {/* Disclaimer */}
          <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
            仅供参考，不构成投资建议
          </span>
        </div>
      </div>

      {/* Right slot */}
      {rightSlot && (
        <div className="shrink-0">{rightSlot}</div>
      )}
    </div>
  );
};
