import type React from 'react';
import { useState } from 'react';
import { ArrowRight, Bot } from 'lucide-react';
import { cn } from '../../utils/cn';

type QuickQuestion = {
  label: string;
  skill?: string;
};

type AgentAskCardProps = {
  onAsk: (question: string, skill?: string) => void;
  quickQuestions?: QuickQuestion[];
  className?: string;
};

const DEFAULT_QUESTIONS: QuickQuestion[] = [
  { label: '今天哪些股票值得关注？' },
  { label: '分析当前持仓风险' },
  { label: '用缠论分析茅台', skill: 'chan_theory' },
  { label: '解读最近报告的买入理由' },
  { label: '趋势策略筛选机会', skill: 'bull_trend' },
];

const CAPABILITIES = ['行情', 'K 线', '技术指标', '新闻', '风险', '策略'];

export const AgentAskCard: React.FC<AgentAskCardProps> = ({
  onAsk,
  quickQuestions = DEFAULT_QUESTIONS,
  className,
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    onAsk(q);
    setInput('');
  };

  return (
    <div
      className={cn(
        'rounded-[var(--metric-card-radius)] border border-[var(--metric-card-border)] bg-[var(--metric-card-bg)] p-4',
        className
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--accent-ai-border)] bg-[var(--accent-ai-soft)]">
          <Bot className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
        </div>
        <p className="text-[13px] font-medium text-foreground">Agent 问股</p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入股票代码或问题…"
            className={cn(
              'h-8 flex-1 min-w-0 rounded-lg border border-border/60 bg-background/60 px-3',
              'text-[12px] text-foreground placeholder:text-muted-foreground/50',
              'focus:border-[var(--accent-ai-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ai-glow)]',
              'transition-all duration-150'
            )}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border',
              'border-[var(--accent-ai-border)] bg-[var(--accent-ai-soft)] text-[var(--accent-ai)]',
              'transition-all hover:shadow-[0_0_12px_var(--accent-ai-glow)]',
              'disabled:cursor-not-allowed disabled:opacity-40'
            )}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>

      {/* Quick questions */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {quickQuestions.slice(0, 4).map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => onAsk(q.label, q.skill)}
            className={cn(
              'rounded-full border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px]',
              'text-muted-foreground transition-all',
              'hover:border-[var(--accent-ai-border)] hover:bg-[var(--accent-ai-soft)] hover:text-[var(--accent-ai)]'
            )}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1">
        {CAPABILITIES.map((cap) => (
          <span
            key={cap}
            className="rounded bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground/70"
          >
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
};
