import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gavel } from 'lucide-react';
import { analysisApi, DuplicateTaskError } from '../api/analysis';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { ApiErrorAlert, Button, Card, Checkbox, EmptyState, InlineAlert } from '../components/common';
import DebateReportMarkdown from '../components/report/DebateReportMarkdown';
import { StockAutocomplete } from '../components/StockAutocomplete';
import { useTaskStream } from '../hooks';
import type { TaskInfo, TaskStatus } from '../types/analysis';

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

  useEffect(() => {
    document.title = '多智能体辩论 - DSA';
    return () => {
      if (pollTimer.current !== null) window.clearInterval(pollTimer.current);
    };
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
      const response = await analysisApi.debate({
        stockCode: value,
        notify,
        forceRefresh,
      });
      const first = 'taskId' in response ? response : response.accepted[0];
      if (first) {
        const acceptedStockCode = 'stockCode' in first && typeof first.stockCode === 'string'
          ? first.stockCode
          : value;
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

  const markdown = completedStatus?.result?.report?.details?.newsContent
    || (completedStatus?.result?.report?.details?.rawResult?.reportMarkdown as string | undefined)
    || '';

  return (
    <div className="min-h-screen bg-base px-4 py-6 md:px-6 lg:px-8">
      <main className="mx-auto flex max-w-6xl flex-col gap-5">
        <Card variant="gradient" padding="lg" className="overflow-hidden">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-xs font-medium text-cyan">
                <Gavel className="h-3.5 w-3.5" />
                独立多智能体辩论
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground md:text-3xl">多智能体辩论分析</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary-text">
                  六个 Agent 先独立分析，再由多方、空方和裁判完成博弈裁定。该流程约 9 次 LLM 调用，默认异步排队执行。
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="space-y-4">
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
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting} isLoading={isSubmitting}>提交辩论</Button>
          </div>
          {error ? <ApiErrorAlert error={error} /> : null}
        </Card>

        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">任务进度</h2>
            <span className="text-xs text-muted-text">辩论任务队列并发为 1</span>
          </div>
          {tasks.length ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.taskId} className="rounded-2xl border border-border/70 bg-elevated/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-cyan">{task.stockCode}</p>
                      <p className="text-xs text-muted-text">{task.message || task.status}</p>
                    </div>
                    <span className="text-xs text-secondary-text">{task.progress}% · {task.status}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary-gradient transition-all" style={{ width: `${Math.max(0, Math.min(100, task.progress || 0))}%` }} />
                  </div>
                  {task.error ? <InlineAlert variant="danger" title="任务失败" message={task.error} className="mt-3" /> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无辩论任务" description="提交股票后可在这里查看阶段进度。" />
          )}
        </Card>

        <Card padding="lg" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">辩论报告</h2>
          {markdown ? <DebateReportMarkdown content={markdown} /> : <EmptyState title="暂无报告" description="辩论任务完成后会展示完整 Markdown 报告。" />}
        </Card>
      </main>
    </div>
  );
};

export default DebateAnalysisPage;
