import type React from 'react';
import { cn } from '../../utils/cn';

export type RankingItem = {
  rank: number;
  label: string;
  sub?: string;
  value: number;
  maxValue: number;
  accent?: boolean;
};

type RankingListProps = {
  items: RankingItem[];
  unit?: string;
  loading?: boolean;
  emptyText?: string;
  className?: string;
};

export const RankingList: React.FC<RankingListProps> = ({
  items,
  unit = '次',
  loading = false,
  emptyText = '暂无数据',
  className,
}) => {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-muted/30" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-10 text-[13px] text-muted-foreground', className)}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) => {
        const pct = item.maxValue > 0 ? (item.value / item.maxValue) * 100 : 0;
        return (
          <div key={item.rank} className="flex items-center gap-3">
            <span
              className={cn(
                'w-5 shrink-0 text-center text-[12px] font-medium tabular-nums',
                item.rank <= 3 ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {item.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="truncate text-[12px] text-foreground">{item.label}</p>
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  {item.value} {unit}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    item.accent ? 'bg-[var(--data-positive)]' : 'bg-[var(--data-positive)]'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
