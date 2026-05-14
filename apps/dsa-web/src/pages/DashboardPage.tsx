import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  Hash,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { systemConfigApi } from '../api/systemConfig';
import { analysisApi } from '../api/analysis';
import { historyApi } from '../api/history';
import type { HistoryItem } from '../types/analysis';
import type { SetupStatusResponse } from '../types/systemConfig';
import {
  StatTile,
  HealthBar,
  PageTabs,
  ChartCard,
  DistributionChart,
  TrendChart,
  RankingList,
} from '../components/dashboard';
import type { HealthBarItem } from '../components/dashboard/HealthBar';
import type { DistributionDataPoint } from '../components/dashboard/DistributionChart';
import type { TrendDataPoint } from '../components/dashboard/TrendChart';
import type { RankingItem } from '../components/dashboard/RankingList';
import { cn } from '../utils/cn';

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateLabel(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}`;
}

function getLast15Days(): string[] {
  const days: string[] = [];
  for (let i = 14; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toDateLabel(d.toISOString()));
  }
  return days;
}

function getTodayLabel(): string {
  return toDateLabel(new Date().toISOString());
}

// ── Main Component ────────────────────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState('analysis');
  const [activeChartTab, setActiveChartTab] = useState('trend');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);
  const [activeTasks, setActiveTasks] = useState<{ taskId: string; stockCode: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = '数据看板 - AI 投研工作台';
  }, []);

  // Load all data
  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [history, status, tasks] = await Promise.allSettled([
          historyApi.getList({ limit: 200 }),
          systemConfigApi.getSetupStatus(),
          analysisApi.getTasks(),
        ]);
        if (!active) return;
        if (history.status === 'fulfilled') setHistoryItems(history.value.items);
        if (status.status === 'fulfilled') setSetupStatus(status.value);
        if (tasks.status === 'fulfilled') setActiveTasks(tasks.value.tasks ?? []);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  // ── Derived metrics ──────────────────────────────────────────────────────
  const today = getTodayLabel();
  const analysisItems = useMemo(
    () => historyItems.filter((h) => h.reportType !== 'debate'),
    [historyItems]
  );
  const debateItems = useMemo(
    () => historyItems.filter((h) => h.reportType === 'debate'),
    [historyItems]
  );

  const todayCount = useMemo(
    () => analysisItems.filter((h) => toDateLabel(h.createdAt) === today).length,
    [analysisItems, today]
  );
  const successRate = useMemo(() => {
    if (historyItems.length === 0) return '--';
    // Use history count as proxy (all fetched items = successful analyses)
    return `${Math.min(100, Math.round((historyItems.length / (historyItems.length + activeTasks.length)) * 100))}%`;
  }, [historyItems.length, activeTasks.length]);

  // Distribution chart data: last 15 days by count
  const last15Days = useMemo(() => getLast15Days(), []);
  const distributionData = useMemo((): DistributionDataPoint[] => {
    const countMap: Record<string, { count: number; debate: number }> = {};
    last15Days.forEach((d) => { countMap[d] = { count: 0, debate: 0 }; });
    analysisItems.forEach((h) => {
      const d = toDateLabel(h.createdAt);
      if (countMap[d]) countMap[d].count += 1;
    });
    debateItems.forEach((h) => {
      const d = toDateLabel(h.createdAt);
      if (countMap[d]) countMap[d].debate += 1;
    });
    return last15Days.map((d) => ({ date: d, count: countMap[d].count, debate: countMap[d].debate }));
  }, [last15Days, analysisItems, debateItems]);

  const trendData = useMemo((): TrendDataPoint[] =>
    distributionData.map((d) => ({ date: d.date, count: d.count + (d.debate ?? 0) })),
    [distributionData]
  );

  // Ranking: top stocks by analysis count
  const rankingItems = useMemo((): RankingItem[] => {
    const countMap: Record<string, { code: string; name: string; count: number }> = {};
    historyItems.forEach((h) => {
      if (!countMap[h.stockCode]) {
        countMap[h.stockCode] = { code: h.stockCode, name: h.stockName ?? h.stockCode, count: 0 };
      }
      countMap[h.stockCode].count += 1;
    });
    const sorted = Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 10);
    const maxVal = sorted[0]?.count ?? 1;
    return sorted.map((s, i) => ({
      rank: i + 1,
      label: s.name !== s.code ? `${s.code} ${s.name}` : s.code,
      value: s.count,
      maxValue: maxVal,
    }));
  }, [historyItems]);

  // Health bar items from setupStatus
  const healthItems = useMemo((): HealthBarItem[] => {
    if (!setupStatus) return [];
    return setupStatus.checks.map((c) => ({
      key: c.key,
      label: c.title,
      value: c.status === 'needs_action' ? '需配置' : c.status === 'optional' ? '可选' : '正常',
      status: c.status === 'needs_action' ? 'warn' : 'ok',
    }));
  }, [setupStatus]);

  // Additional health bar: custom metrics
  const systemHealthItems = useMemo((): HealthBarItem[] => [
    { key: 'tasks', label: '活跃任务', value: String(activeTasks.length), status: (activeTasks.length > 5 ? 'warn' : 'ok') as 'ok' | 'warn' },
    { key: 'today', label: '今日分析', value: String(todayCount), status: 'ok' as const },
    { key: 'total', label: '累计记录', value: String(historyItems.length), status: 'ok' as const },
    ...healthItems.slice(0, 4),
  ], [activeTasks.length, todayCount, historyItems.length, healthItems]);

  const mainTabs = [
    { key: 'analysis', label: '分析统计', count: historyItems.length },
    { key: 'system',   label: '系统状态' },
  ];

  const chartTabs = [
    { key: 'trend',        label: '调用趋势' },
    { key: 'distribution', label: '消耗分布' },
    { key: 'ranking',      label: '调用排行' },
  ];

  return (
    <div className="flex flex-col">
      {/* ── Main tabs ── */}
      <PageTabs
        tabs={mainTabs}
        activeKey={activeMainTab}
        onChange={setActiveMainTab}
        className="bg-background px-2"
      />

      {/* ── Health bar ── */}
      <HealthBar items={systemHealthItems} />

      {/* ── Content area ── */}
      <div className="flex-1 overflow-auto p-5 space-y-5">

        {/* Stat tiles row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="总分析数"
            value={historyItems.length}
            subLabel="统计计数"
            icon={<Hash />}
            loading={isLoading}
          />
          <StatTile
            label="今日分析"
            value={todayCount}
            subLabel="今日新增"
            icon={<Clock />}
            loading={isLoading}
          />
          <StatTile
            label="累计报告"
            value={analysisItems.length}
            subLabel="分析报告"
            icon={<FileText />}
            loading={isLoading}
          />
          <StatTile
            label="多智辩论"
            value={debateItems.length}
            subLabel="辩论分析"
            icon={<Bot />}
            loading={isLoading}
          />
          <StatTile
            label="任务成功率"
            value={isLoading ? '--' : successRate}
            subLabel="综合成功率"
            icon={<Activity />}
            accent
            loading={isLoading}
          />
        </div>

        {/* Main content: charts */}
        {activeMainTab === 'analysis' && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Distribution chart — takes 2 columns on xl */}
            <ChartCard
              title="分析调用趋势"
              subtitle="近 15 天"
              total={`共 ${historyItems.length} 次`}
              className="xl:col-span-2"
            >
              <DistributionChart data={distributionData} />
            </ChartCard>

            {/* Quick stats — 1 column */}
            <div className="space-y-3">
              {/* Data source health */}
              <ChartCard title="系统健康">
                <div className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-6 animate-pulse rounded bg-muted/30" />
                      ))}
                    </div>
                  ) : setupStatus?.checks.slice(0, 5).map((c) => (
                    <div key={c.key} className="flex items-center justify-between text-[12px]">
                      <span className="text-muted-foreground">{c.title}</span>
                      <span
                        className={cn(
                          'font-medium',
                          c.status === 'needs_action' ? 'text-[var(--data-warning)]' : 'text-[var(--data-positive)]'
                        )}
                      >
                        {c.status === 'needs_action' ? '需配置' : '正常'}
                      </span>
                    </div>
                  ))}
                  {!isLoading && setupStatus && !setupStatus.isComplete && (
                    <button
                      type="button"
                      onClick={() => navigate('/settings')}
                      className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground hover:bg-hover hover:text-foreground"
                    >
                      去完成配置 →
                    </button>
                  )}
                </div>
              </ChartCard>

              {/* Active tasks */}
              <ChartCard title="活跃任务">
                {activeTasks.length === 0 ? (
                  <div className="flex items-center gap-2 text-[12px] text-[var(--data-positive)]">
                    <CheckCircle2 className="h-4 w-4" />
                    无进行中任务
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeTasks.slice(0, 5).map((t, i) => (
                      <div key={t.taskId ?? i} className="flex items-center gap-2 text-[12px]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--data-warning)]" />
                        <span className="truncate text-muted-foreground">{t.stockCode ?? `任务 ${i + 1}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            </div>
          </div>
        )}

        {/* Analysis detail charts */}
        {activeMainTab === 'analysis' && (
          <ChartCard
            title="分析记录详情"
            total={`共 ${historyItems.length} 条`}
            tabs={chartTabs}
            activeTab={activeChartTab}
            onTabChange={setActiveChartTab}
          >
            {activeChartTab === 'trend' && (
              <TrendChart data={trendData} height={200} type="area" />
            )}
            {activeChartTab === 'distribution' && (
              <DistributionChart data={distributionData} height={200} />
            )}
            {activeChartTab === 'ranking' && (
              <RankingList
                items={rankingItems}
                unit="次"
                loading={isLoading}
                emptyText="暂无分析记录"
              />
            )}
          </ChartCard>
        )}

        {/* System tab */}
        {activeMainTab === 'system' && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {setupStatus?.checks.map((c) => (
              <div
                key={c.key}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{c.title}</p>
                  {c.message && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.message}</p>
                  )}
                </div>
                <span
                  className={cn(
                    'ml-4 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                    c.status === 'needs_action'
                      ? 'bg-[var(--data-warning)]/10 text-[var(--data-warning)]'
                      : 'bg-[var(--data-positive)]/10 text-[var(--data-positive)]'
                  )}
                >
                  {c.status === 'needs_action' ? '需配置' : c.status === 'optional' ? '可选' : '正常'}
                </span>
              </div>
            ))}
            {!setupStatus && !isLoading && (
              <p className="text-[13px] text-muted-foreground">无法获取系统状态</p>
            )}
          </div>
        )}

        {/* Footer disclaimer */}
        <p className="text-[11px] text-muted-foreground/50 text-center pt-2">
          AI 分析结果仅供参考，不构成投资建议
        </p>
      </div>
    </div>
  );
};

export default DashboardPage;
