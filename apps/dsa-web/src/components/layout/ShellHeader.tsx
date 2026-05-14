import type React from 'react';
import { useEffect, useState } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ThemeToggle } from '../theme/ThemeToggle';
import { systemConfigApi } from '../../api/systemConfig';
import { cn } from '../../utils/cn';

type ShellHeaderProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
};

const TITLES: Record<string, { title: string; description: string }> = {
  '/': { title: 'AI 股票投研工作台', description: 'A/H/美股智能分析 · 报告 · Agent 问股 · 任务监控' },
  '/debate': { title: '多智辩论分析', description: '多 Agent 视角辩论 · 全方位解读个股' },
  '/chat': { title: 'Agent 问股', description: '多轮策略问答 · 历史会话管理' },
  '/portfolio': { title: '持仓管理', description: '账户 · 交易 · 风险分析' },
  '/backtest': { title: '策略回测', description: '回测任务 · 结果浏览 · 胜率统计' },
  '/settings': { title: '系统配置', description: '模型 · 数据源 · 推送渠道 · 认证' },
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

export const ShellHeader: React.FC<ShellHeaderProps> = ({
  collapsed,
  onToggleSidebar,
  onOpenMobileNav,
}) => {
  const location = useLocation();
  const current = TITLES[location.pathname] ?? { title: 'AI 投研工作台', description: '' };

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [systemOk, setSystemOk] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    systemConfigApi.getSetupStatus()
      .then((s) => { if (active) setSystemOk(s.isComplete); })
      .catch(() => { if (active) setSystemOk(false); });
    return () => { active = false; };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/90 px-4 backdrop-blur-xl">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card/70 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground lg:hidden"
        aria-label="打开导航菜单"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Desktop sidebar toggle */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="hidden h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card/50 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground lg:inline-flex"
        aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>

      {/* Page title */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
          {current.title}
        </p>
        <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
          {current.description}
        </p>
      </div>

      {/* Right side: time + status + theme */}
      <div className="flex shrink-0 items-center gap-3">
        {/* System status dot */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              systemOk === null
                ? 'bg-muted-foreground/40 animate-pulse'
                : systemOk
                  ? 'bg-[var(--status-online)] shadow-[0_0_6px_var(--status-online)]'
                  : 'bg-[var(--status-warning)] shadow-[0_0_6px_var(--status-warning)] animate-pulse'
            )}
          />
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {systemOk === null ? '检测中' : systemOk ? '系统正常' : '需要配置'}
          </span>
        </div>

        {/* Clock */}
        <div className="hidden flex-col items-end sm:flex">
          <span className="text-[12px] tabular-nums font-medium text-foreground leading-tight">
            {formatTime(now)}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground leading-tight">
            {formatDate(now)}
          </span>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
};
