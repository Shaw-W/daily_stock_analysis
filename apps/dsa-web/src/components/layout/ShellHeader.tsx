import type React from 'react';
import { Filter, Menu, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../theme/ThemeToggle';
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

export const ShellHeader: React.FC<ShellHeaderProps> = ({
  collapsed,
  onToggleSidebar,
  onOpenMobileNav,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = TITLES[location.pathname] ?? { title: 'AI 投研工作台', description: '' };

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

      {/* Right: New-API style action buttons */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-card/60',
            'px-2.5 text-[12px] text-muted-foreground',
            'transition-colors hover:bg-hover hover:text-foreground'
          )}
        >
          <Settings className="h-3 w-3" />
          <span className="hidden sm:inline">偏好设置</span>
        </button>

        <button
          type="button"
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-card/60',
            'px-2.5 text-[12px] text-muted-foreground',
            'transition-colors hover:bg-hover hover:text-foreground'
          )}
          aria-label="筛选"
        >
          <Filter className="h-3 w-3" />
          <span className="hidden sm:inline">筛选</span>
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
};
