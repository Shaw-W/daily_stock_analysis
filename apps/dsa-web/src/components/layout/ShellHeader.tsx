import type React from 'react';
import { useEffect, useState } from 'react';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';

type ShellHeaderProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
};

const TITLES: Record<string, { title: string; description: string }> = {
  '/':          { title: '数据看板',     description: '运行总览与系统状态' },
  '/analyze':   { title: '股票分析',     description: 'A/H/美股智能分析与历史报告' },
  '/debate':    { title: '多智辩论分析', description: '多 Agent 视角辩论' },
  '/chat':      { title: 'Agent 问股',   description: '多轮策略问答与历史会话' },
  '/portfolio': { title: '持仓管理',     description: '账户 · 交易 · 风险分析' },
  '/backtest':  { title: '策略回测',     description: '回测任务 · 结果浏览 · 胜率统计' },
  '/settings':  { title: '系统配置',     description: '模型 · 数据源 · 推送渠道 · 认证' },
};

type AShareStatus = {
  label: '休市' | '盘中休市' | '交易中';
  active: boolean;
};

function getAShareStatus(now: Date): AShareStatus {
  const day = now.getDay(); // 0=Sun, 6=Sat
  const time = now.getHours() * 100 + now.getMinutes();
  if (day === 0 || day === 6) return { label: '休市', active: false };
  if (time >= 930 && time < 1130) return { label: '交易中', active: true };
  if (time >= 1130 && time < 1300) return { label: '盘中休市', active: false };
  if (time >= 1300 && time < 1500) return { label: '交易中', active: true };
  return { label: '休市', active: false };
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

export const ShellHeader: React.FC<ShellHeaderProps> = ({
  collapsed,
  onToggleSidebar,
  onOpenMobileNav,
}) => {
  const location = useLocation();
  const current = TITLES[location.pathname] ?? { title: '股票智能分析系统', description: '' };

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const status = getAShareStatus(now);
  const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onOpenMobileNav}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md',
          'border border-border/60 bg-card/60 text-muted-foreground',
          'transition-colors hover:bg-hover hover:text-foreground lg:hidden'
        )}
        aria-label="打开导航菜单"
      >
        <Menu className="h-3.5 w-3.5" />
      </button>

      {/* Desktop sidebar toggle */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className={cn(
          'hidden h-7 w-7 items-center justify-center rounded-md',
          'border border-border/60 bg-card/60 text-muted-foreground',
          'transition-colors hover:bg-hover hover:text-foreground lg:inline-flex'
        )}
        aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftClose className="h-3.5 w-3.5" />
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

      {/* Right: Clock + A-share status */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Clock */}
        <div className="hidden sm:flex flex-col items-end leading-none">
          <span className="font-mono text-[13px] tabular-nums text-foreground">{timeStr}</span>
          <span className="text-[10px] text-muted-foreground">{dateStr}</span>
        </div>

        {/* A-share status badge */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
            status.active
              ? 'border-[var(--data-danger,#ef4444)]/30 bg-[var(--data-danger,#ef4444)]/10 text-[var(--data-danger,#ef4444)]'
              : 'border-[var(--data-positive)]/30 bg-[var(--data-positive)]/10 text-[var(--data-positive)]'
          )}
        >
          {status.active ? (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--data-danger,#ef4444)] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--data-danger,#ef4444)]" />
            </span>
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-positive)]" />
          )}
          <span>{status.label}</span>
        </div>
      </div>
    </header>
  );
};
