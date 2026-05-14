/**
 * AnalyzePage — 股票分析工作台
 * 从原 HomePage 剥离而来。包含：搜索 + 大盘复盘 + 任务历史侧栏 + 报告展示。
 * 指标看板已移至 DashboardPage (/)。
 */
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { analysisApi } from '../api/analysis';
import { systemConfigApi } from '../api/systemConfig';
import {
  ApiErrorAlert,
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
} from '../components/common';
import { DashboardStateBlock } from '../components/dashboard';
import { StockAutocomplete } from '../components/StockAutocomplete';
import { HistoryList } from '../components/history';
import { ReportMarkdown, ReportSummary } from '../components/report';
import { TaskPanel } from '../components/tasks';
import { useDashboardLifecycle, useHomeDashboardState } from '../hooks';
import type { SetupStatusResponse } from '../types/systemConfig';
import { getReportText, normalizeReportLanguage } from '../utils/reportLanguage';
import { useMemo } from 'react';

type MarketReviewNotice = {
  variant: 'success' | 'warning' | 'danger';
  title: string;
  message: string;
} | null;

const AnalyzePage: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmittingMarketReview, setIsSubmittingMarketReview] = useState(false);
  const [marketReviewNotice, setMarketReviewNotice] = useState<MarketReviewNotice>(null);
  const [marketReviewError, setMarketReviewError] = useState<ParsedApiError | null>(null);
  const [marketReviewReport, setMarketReviewReport] = useState<string | null>(null);
  const [marketReviewReportCopied, setMarketReviewReportCopied] = useState(false);
  const marketReviewPollTimer = useRef<number | null>(null);
  const dashboardScrollRef = useRef<HTMLElement | null>(null);

  // ── Existing hooks (ALL preserved) ───────────────────────────────────────
  const {
    query,
    inputError,
    duplicateError,
    error,
    isAnalyzing,
    historyItems,
    selectedHistoryIds,
    isDeletingHistory,
    isLoadingHistory,
    isLoadingMore,
    hasMore,
    selectedReport,
    isLoadingReport,
    activeTasks,
    markdownDrawerOpen,
    setQuery,
    clearError,
    loadInitialHistory,
    refreshHistory,
    loadMoreHistory,
    selectHistoryItem,
    toggleHistorySelection,
    toggleSelectAllVisible,
    deleteSelectedHistory,
    submitAnalysis,
    notify,
    setNotify,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
    openMarkdownDrawer,
    closeMarkdownDrawer,
    selectedIds,
  } = useHomeDashboardState();

  useEffect(() => {
    document.title = '股票分析 - AI 投研工作台';
  }, []);

  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);
  useEffect(() => {
    let active = true;
    systemConfigApi.getSetupStatus()
      .then((status) => { if (active) setSetupStatus(status); })
      .catch(() => { if (active) setSetupStatus(null); });
    return () => { active = false; };
  }, []);

  const reportLanguage = normalizeReportLanguage(selectedReport?.meta.reportLanguage);
  const reportText = getReportText(reportLanguage);
  const setupNeedsAction = setupStatus ? !setupStatus.isComplete : false;
  const setupMissingLabels = useMemo(() => {
    if (!setupStatus) return '';
    return setupStatus.checks
      .filter((c) => c.required && c.status === 'needs_action')
      .map((c) => c.title)
      .slice(0, 3)
      .join('、');
  }, [setupStatus]);

  useDashboardLifecycle({
    loadInitialHistory,
    refreshHistory,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
  });

  // ── Market review ─────────────────────────────────────────────────────────
  const stopMarketReviewPolling = useCallback(() => {
    if (marketReviewPollTimer.current !== null) {
      window.clearInterval(marketReviewPollTimer.current);
      marketReviewPollTimer.current = null;
    }
  }, []);

  const scrollFeedbackIntoView = useCallback(() => {
    const el = dashboardScrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
    else el.scrollTop = 0;
  }, []);

  useEffect(() => stopMarketReviewPolling, [stopMarketReviewPolling]);

  const pollMarketReviewStatus = useCallback(async (taskId: string) => {
    stopMarketReviewPolling();
    const maxAttempts = 120;
    const intervalMs = 2000;
    let attempts = 0;
    const poll = async (): Promise<boolean> => {
      if (attempts >= maxAttempts) {
        stopMarketReviewPolling();
        setMarketReviewNotice({ variant: 'danger', title: '大盘复盘已超时', message: '任务长时间未返回结果。' });
        scrollFeedbackIntoView();
        return false;
      }
      attempts += 1;
      try {
        const status = await analysisApi.getStatus(taskId);
        if (status.status === 'pending' || status.status === 'processing') {
          const progress = typeof status.progress === 'number' ? `${status.progress}%` : '进行中';
          setMarketReviewNotice({ variant: 'warning', title: '大盘复盘进行中', message: `${status.status}（${progress}）` });
          return true;
        }
        if (status.status === 'completed') {
          stopMarketReviewPolling();
          const text = typeof status.marketReviewReport === 'string' ? status.marketReviewReport : '';
          setMarketReviewReport(text ? text.trim() : null);
          setMarketReviewNotice({ variant: 'success', title: '大盘复盘已完成', message: text ? '结果如下：' : '已按配置推送。' });
          setMarketReviewError(null);
          scrollFeedbackIntoView();
          return false;
        }
        if (status.status === 'failed') {
          stopMarketReviewPolling();
          setMarketReviewError(getParsedApiError({ response: { status: 500, data: { error: 'failed', message: status.error ?? '失败' } } }));
          setMarketReviewNotice(null);
          scrollFeedbackIntoView();
          return false;
        }
        return false;
      } catch {
        if (attempts >= maxAttempts) { stopMarketReviewPolling(); return false; }
        return true;
      }
    };
    if (await poll()) {
      marketReviewPollTimer.current = window.setInterval(() => {
        void poll().then((c) => { if (!c) stopMarketReviewPolling(); });
      }, intervalMs);
    }
  }, [scrollFeedbackIntoView, stopMarketReviewPolling]);

  const handleTriggerMarketReview = useCallback(async () => {
    setIsSubmittingMarketReview(true);
    setMarketReviewNotice(null);
    setMarketReviewError(null);
    setMarketReviewReport(null);
    scrollFeedbackIntoView();
    try {
      const result = await analysisApi.triggerMarketReview({ sendNotification: notify });
      setMarketReviewNotice({ variant: 'success', title: '大盘复盘已提交', message: result.message });
      scrollFeedbackIntoView();
      if (result.taskId) await pollMarketReviewStatus(result.taskId);
    } catch (err) {
      setMarketReviewError(getParsedApiError(err));
      scrollFeedbackIntoView();
    } finally {
      setIsSubmittingMarketReview(false);
    }
  }, [notify, pollMarketReviewStatus, scrollFeedbackIntoView]);

  const handleCopyMarketReviewReport = useCallback(() => {
    if (!marketReviewReport) return;
    void navigator.clipboard.writeText(marketReviewReport).then(
      () => { setMarketReviewReportCopied(true); setTimeout(() => setMarketReviewReportCopied(false), 2000); },
      (err) => { console.error('复制失败:', err); }
    );
  }, [marketReviewReport]);

  // ── Handlers (ALL preserved) ──────────────────────────────────────────────
  const handleHistoryItemClick = useCallback((recordId: number) => {
    void selectHistoryItem(recordId);
    setSidebarOpen(false);
  }, [selectHistoryItem]);

  const handleSubmitAnalysis = useCallback(
    (stockCode?: string, stockName?: string, selectionSource?: 'manual' | 'autocomplete' | 'import' | 'image') => {
      void submitAnalysis({ stockCode, stockName, originalQuery: query, selectionSource: selectionSource ?? 'manual' });
    },
    [query, submitAnalysis],
  );

  const handleAskFollowUp = useCallback(() => {
    if (selectedReport?.meta.id === undefined) return;
    const code = selectedReport.meta.stockCode;
    const name = selectedReport.meta.stockName;
    const rid = selectedReport.meta.id;
    navigate(`/chat?stock=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}&recordId=${rid}`);
  }, [navigate, selectedReport]);

  const handleReanalyze = useCallback(() => {
    if (!selectedReport) return;
    void submitAnalysis({ stockCode: selectedReport.meta.stockCode, stockName: selectedReport.meta.stockName, originalQuery: selectedReport.meta.stockCode, selectionSource: 'manual', forceRefresh: true });
  }, [selectedReport, submitAnalysis]);

  const handleDeleteSelectedHistory = useCallback(() => {
    void deleteSelectedHistory();
    setShowDeleteConfirm(false);
  }, [deleteSelectedHistory]);

  // ── Sidebar content ───────────────────────────────────────────────────────
  const sidebarContent = useMemo(() => (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <TaskPanel tasks={activeTasks} />
      <HistoryList
        items={historyItems}
        isLoading={isLoadingHistory}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        selectedId={selectedReport?.meta.id}
        selectedIds={selectedIds}
        isDeleting={isDeletingHistory}
        onItemClick={handleHistoryItemClick}
        onLoadMore={() => void loadMoreHistory()}
        onToggleItemSelection={toggleHistorySelection}
        onToggleSelectAll={toggleSelectAllVisible}
        onDeleteSelected={() => setShowDeleteConfirm(true)}
        filter="analysis"
        className="flex-1 overflow-hidden"
      />
    </div>
  ), [
    activeTasks, hasMore, historyItems, isDeletingHistory, isLoadingHistory, isLoadingMore,
    handleHistoryItemClick, loadMoreHistory, selectedIds, selectedReport?.meta.id,
    toggleHistorySelection, toggleSelectAllVisible,
  ]);

  return (
    <div data-testid="home-dashboard" className="flex h-full flex-col overflow-hidden">
      {/* ── Search bar ── */}
      <div className="shrink-0 border-b border-border/50 bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Mobile history button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="sm:hidden flex items-center gap-1.5 self-start rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-hover"
            aria-label="历史记录"
          >
            <Clock className="h-3.5 w-3.5" />
            历史记录
          </button>

          <div className="min-w-0 flex-1">
            <StockAutocomplete
              value={query}
              onChange={setQuery}
              onSubmit={(stockCode, stockName, selectionSource) => {
                handleSubmitAnalysis(stockCode, stockName, selectionSource);
              }}
              placeholder="输入股票代码或名称，如 600519、贵州茅台、AAPL"
              disabled={isAnalyzing}
              className={inputError ? 'border-danger/50' : undefined}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border/50 bg-card/50 px-3 text-[12px] text-muted-foreground select-none hover:bg-hover transition-colors">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="h-3 w-3 rounded border-border accent-primary"
              />
              推送通知
            </label>
            <Button
              type="button"
              variant="secondary"
              size="md"
              isLoading={isSubmittingMarketReview}
              loadingText="提交中"
              onClick={() => void handleTriggerMarketReview()}
              className="h-9 whitespace-nowrap"
            >
              <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              大盘复盘
            </Button>
            <button
              type="button"
              onClick={() => handleSubmitAnalysis()}
              disabled={!query || isAnalyzing}
              className="btn-primary flex h-9 items-center gap-1.5 whitespace-nowrap"
            >
              {isAnalyzing ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  分析中
                </>
              ) : (
                <>
                  <TrendingUp className="h-3.5 w-3.5" />
                  分析
                </>
              )}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {inputError && (
          <InlineAlert variant="danger" title="输入有误" message={inputError} className="mt-2 rounded-md px-3 py-2 text-xs shadow-none" />
        )}
        {!inputError && duplicateError && (
          <InlineAlert variant="warning" title="任务已存在" message={duplicateError} className="mt-2 rounded-md px-3 py-2 text-xs shadow-none" />
        )}
        {setupNeedsAction && (
          <InlineAlert
            variant="warning"
            title="基础配置未完成"
            message={setupMissingLabels ? `还缺少 ${setupMissingLabels}，完成后即可开始分析。` : '还缺少基础配置，完成后即可开始分析。'}
            action={<Button type="button" variant="secondary" size="sm" onClick={() => navigate('/settings')}>去配置</Button>}
            className="mt-2 rounded-md px-3 py-2 text-xs shadow-none"
          />
        )}
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Tasks + Analysis History */}
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

        {/* Center: Report area */}
        <section
          ref={dashboardScrollRef}
          data-testid="home-dashboard-scroll"
          className="flex flex-1 min-w-0 flex-col gap-3 overflow-y-auto px-4 py-3 touch-pan-y"
        >
          {marketReviewNotice && (
            <InlineAlert variant={marketReviewNotice.variant} title={marketReviewNotice.title} message={marketReviewNotice.message} className="rounded-md px-3 py-2 text-xs shadow-none" />
          )}
          {marketReviewError && (
            <ApiErrorAlert error={marketReviewError} onDismiss={() => setMarketReviewError(null)} />
          )}
          {marketReviewReport && (
            <div className="rounded-md border border-border/50 bg-card/70 px-3 py-3 text-xs">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">大盘复盘报告</p>
                <button
                  type="button"
                  className="home-surface-button h-7 rounded-md px-3 py-1 text-xs text-foreground"
                  disabled={marketReviewReportCopied}
                  onClick={() => void handleCopyMarketReviewReport()}
                >
                  {marketReviewReportCopied ? '已复制' : '复制'}
                </button>
              </div>
              <pre
                data-testid="market-review-report"
                className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-background/60 px-3 py-2 leading-relaxed text-muted-foreground"
              >
                {marketReviewReport}
              </pre>
            </div>
          )}

          {error && <ApiErrorAlert error={error} onDismiss={clearError} />}

          {isLoadingReport ? (
            <div className="flex flex-1 items-center justify-center">
              <DashboardStateBlock title="加载报告中..." loading />
            </div>
          ) : selectedReport ? (
            <div className="max-w-4xl space-y-4 pb-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground/50">
                  AI 分析结果仅供参考，不构成投资建议
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="home-action-ai" size="sm" disabled={isAnalyzing || selectedReport.meta.id === undefined} onClick={handleReanalyze}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {reportText.reanalyze}
                  </Button>
                  <Button variant="home-action-ai" size="sm" disabled={selectedReport.meta.id === undefined} onClick={handleAskFollowUp}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    追问 AI
                  </Button>
                  <Button variant="home-action-ai" size="sm" disabled={selectedReport.meta.id === undefined} onClick={openMarkdownDrawer}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {reportText.fullReport}
                  </Button>
                </div>
              </div>
              <ReportSummary data={selectedReport} isHistory />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title="开始分析"
                description="输入股票代码或名称进行分析，或从左侧选择历史报告查看。"
                className="max-w-sm"
                icon={<TrendingUp className="h-6 w-6" />}
              />
            </div>
          )}
        </section>
      </div>

      {/* ── Dialogs ── */}
      {markdownDrawerOpen && selectedReport?.meta.id && (
        <ReportMarkdown
          recordId={selectedReport.meta.id}
          stockName={selectedReport.meta.stockName || ''}
          stockCode={selectedReport.meta.stockCode}
          reportLanguage={reportLanguage}
          onClose={closeMarkdownDrawer}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除历史记录"
        message={
          selectedHistoryIds.length === 1
            ? '确认删除这条历史记录吗？删除后将不可恢复。'
            : `确认删除选中的 ${selectedHistoryIds.length} 条历史记录吗？删除后将不可恢复。`
        }
        confirmText={isDeletingHistory ? '删除中...' : '确认删除'}
        cancelText="取消"
        isDanger
        onConfirm={handleDeleteSelectedHistory}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

export default AnalyzePage;
