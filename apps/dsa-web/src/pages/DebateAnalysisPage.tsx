import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Gavel } from 'lucide-react';
import { analysisApi, DuplicateTaskError } from '../api/analysis';
import { historyApi } from '../api/history';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { ApiErrorAlert, Button, Checkbox, EmptyState, InlineAlert } from '../components/common';
import DebateReportMarkdown from '../components/report/DebateReportMarkdown';
import { StockAutocomplete } from '../components/StockAutocomplete';
import { HistoryList } from '../components/history';
import { useTaskStream } from '../hooks';
import type { HistoryItem, TaskInfo, TaskStatus } from '../types/analysis';
import { cn } from '../utils/cn';

type SelectionSource = 'manual' | 'autocomplete' | 'import' | 'image';

const DebateAnalysisPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [notify, setNotify] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [activeTasks, setActiveTasks] = useState<Record<string, TaskInfo>>({});
  const [completedStatus, setCompletedStatus] = useState<TaskStatus | null>(null);
  const pollTimer = useRef<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // History state for debate records
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    document.title = '多智辩论分析 - AI 投研工作台';
    return () => {
      if (pollTimer.current !== null) window.clearInterval(pollTimer.current);
    };
  }, []);

  // Load debate history
  useEffect(() => {
    let active = true;
    setIsLoadingHistory(true);
    historyApi.getList({ limit: 100 })
      .then((res) => { if (active) setHistoryItems(res.items); })
      .catch(() => {})
      .finally(() => { if (active) setIsLoadingHistory(false); });
    return () => { active = false; };
  }, []);

  const tasks = useMemo(() => Object.values(activeTasks).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [activeTasks]);

  const upsertTask = useCallback((task: TaskInfo) => {
    if (task.reportType !== 'debate') return;
    setActiveTasks((prev) => ({ ...prev, [task.taskId]: task }));
  }, []);

  const fetchCompletedStatus = useCallback(async (taskId: string) => {
    try {
      const status = await analysisApi.getStatus(taskId);
      setCompletedStatus(status);
    } catch (err) {
      setError(getParsedApiError(err));
    }
  }, []);

  useTaskStream({
    onTaskCreated: upsertTask,
    onTaskStarted: upsertTask,
    onTaskProgress: upsertTask,
    onTaskCompleted: (task) => {
      upsertTask(task);
      if (task.reportType === 'debate') void fetchCompletedStatus(task.taskId);
    },
    onTaskFailed: upsertTask,
  });

  const startPolling = useCallback((taskId: string) => {
    if (pollTimer.current !== null) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(async () => {
      try {
        const status = await analysisApi.getStatus(taskId);
        if (status.status === 'completed' || status.status === 'failed') {
          if (pollTimer.current !== null) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
          setCompletedStatus(status);
          // Refresh debate history
          historyApi.getList({ limit: 100 }).then((res) => setHistoryItems(res.items)).catch(() => {});
        }
      } catch {
        // SSE is primary; polling is best-effort fallback.
      }
    }, 2500);
  }, []);

  const handleSubmit = useCallback(async (stockCode?: string, stockName?: string, selectionSource?: SelectionSource) => {
    const value = stockCode || query.trim();
    if (!value) {
      setError(getParsedApiError({ response: { status: 400, data: { message: '请输入股票代码或名称' } } }));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setCompletedStatus(null);
    try {
      const response = await analysisApi.debate({ stockCode: value, notify, forceRefresh });
      const first = 'taskId' in response ? response : response.accepted[0];
      if (first) {
        const acceptedStockCode = 'stockCode' in first && typeof first.stockCode === 'string'
          ? first.stockCode : value;
        setActiveTasks((prev) => ({
          ...prev,
          [first.taskId]: {
            taskId: first.taskId,
            stockCode: acceptedStockCode,
            stockName,
            status: first.status,
            progress: 0,
            message: first.message || '辩论任务已提交',
            reportType: 'debate',
            createdAt: new Date().toISOString(),
            selectionSource: selectionSource === 'image' || selectionSource === 'import' ? selectionSource : selectionSource,
          },
        }));
        startPolling(first.taskId);
      }
    } catch (err) {
      if (err instanceof DuplicateTaskError) {
        setError(getParsedApiError({ response: { status: 409, data: { message: err.message } } }));
      } else {
        setError(getParsedApiError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [forceRefresh, notify, query, startPolling]);

  const handleHistoryItemClick = useCallback((recordId: number) => {
    // Load debate result from history — just navigate to report view
    // For now: fetch status/markdown for the selected history item
    historyApi.getDetail(recordId)
      .then((report) => {
        // Construct a minimal TaskStatus-like object
        const markdown = (report as unknown as { details?: { rawResult?: { reportMarkdown?: string } } })
          ?.details?.rawResult?.reportMarkdown ?? '';
        if (markdown) {
          setCompletedStatus({
            taskId: 'history',
            status: 'completed',
            progress: 100,
            result: { report: { details: { rawResult: { reportMarkdown: markdown } } } } as unknown as TaskStatus['result'],
            marketReviewReport: undefined,
          });
        }
        setSidebarOpen(false);
      })
      .catch(() => {});
  }, []);

  const markdown = completedStatus?.result?.report?.details?.newsContent
    || (completedStatus?.result?.report?.details?.rawResult?.reportMarkdown as string | undefined)
    || '';

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden">
      <HistoryList
        items={historyItems}
        isLoading={isLoadingHistory}
        isLoadingMore={false}
        hasMore={false}
        selectedIds={selectedIds}
        isDeleting={false}
        onItemClick={handleHistoryItemClick}
        onLoadMore={() => {}}
        onToggleItemSelection={() => {}}
        onToggleSelectAll={() => {}}
        onDeleteSelected={() => {}}
        filter="debate"
        className="flex-1 overflow-hidden"
      />
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Debate history ── */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-hidden border-r border-border/40 p-3 sm:flex lg:w-72">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/65" />
          <div
            className="dashboard-card absolute bottom-0 left-0 top-0 flex w-72 flex-col overflow-hidden !rounded-none !rounded-r-xl p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* ── Right: Debate form + results ── */}
      <div className="flex flex-1 min-w-0 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-4 p-4 pb-8">
          {/* Mobile history button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="sm:hidden flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-hover"
          >
            <Clock className="h-3.5 w-3.5" />
            辩论历史
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-foreground">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-[14px] font-semibold text-foreground">多智能体辩论分析</h1>
              <p className="text-[11px] text-muted-foreground">
                六个 Agent 先独立分析，再由多方、空方和裁判完成博弈裁定。约 9 次 LLM 调用，默认异步排队执行。
              </p>
            </div>
          </div>

          {/* Search + submit */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <StockAutocomplete
              value={query}
              onChange={setQuery}
              onSubmit={(stockCode, stockName, source) => void handleSubmit(stockCode, stockName, source)}
              placeholder="输入股票代码或名称，如 600519 / 贵州茅台"
              disabled={isSubmitting}
            />
            <div className="flex flex-wrap items-center gap-4 text-sm text-secondary-text">
              <Checkbox checked={notify} onChange={(event) => setNotify(event.target.checked)} label="完成后推送通知" />
              <Checkbox checked={forceRefresh} onChange={(event) => setForceRefresh(event.target.checked)} label="强制刷新数据" />
              <Button onClick={() => void handleSubmit()} disabled={isSubmitting} isLoading={isSubmitting}>
                提交辩论
              </Button>
            </div>
            {error ? <ApiErrorAlert error={error} /> : null}
          </div>

          {/* Task progress */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-foreground">任务进度</h2>
              <span className="text-[11px] text-muted-foreground">辩论任务队列并发为 1</span>
            </div>
            {tasks.length ? (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.taskId} className="rounded-md border border-border bg-elevated/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className={cn('font-mono text-sm', task.status === 'completed' ? 'text-[var(--data-positive)]' : 'text-foreground')}>
                          {task.stockCode}
                          {task.stockName && task.stockName !== task.stockCode && (
                            <span className="ml-1.5 font-sans font-normal text-muted-foreground">{task.stockName}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{task.message || task.status}</p>
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{task.progress}% · {task.status}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/30">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          task.status === 'completed' ? 'bg-[var(--data-positive)]' : 'bg-foreground/70'
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }}
                      />
                    </div>
                    {task.error ? <InlineAlert variant="danger" title="任务失败" message={task.error} className="mt-2" /> : null}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无辩论任务" description="提交股票后可在这里查看阶段进度。" />
            )}
          </div>

          {/* Report */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-[13px] font-semibold text-foreground">辩论报告</h2>
            {markdown ? (
              <>
                <DebateReportMarkdown content={markdown} />
                <p className="text-[11px] text-muted-foreground/50 text-center pt-2">
                  AI 分析结果仅供参考，不构成投资建议
                </p>
              </>
            ) : (
              <EmptyState title="暂无报告" description="辩论任务完成后会展示完整 Markdown 报告。" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebateAnalysisPage;
