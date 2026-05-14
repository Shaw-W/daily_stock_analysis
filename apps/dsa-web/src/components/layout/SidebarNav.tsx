import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  BriefcaseBusiness,
  Gavel,
  LayoutDashboard,
  LogOut,
  MessageSquareQuote,
  Settings2,
  TrendingUp,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAgentChatStore } from '../../stores/agentChatStore';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StatusDot } from '../common/StatusDot';
import { ThemeToggle } from '../theme/ThemeToggle';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

type NavItem = {
  key: string;
  label: string;
  desc: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: 'completion';
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: '工作台', desc: '分析与报告', to: '/', icon: LayoutDashboard, exact: true },
  { key: 'debate', label: '多智辩论', desc: 'Multi-Agent', to: '/debate', icon: Gavel },
  { key: 'chat', label: 'Agent 问股', desc: 'AI 对话', to: '/chat', icon: MessageSquareQuote, badge: 'completion' },
  { key: 'portfolio', label: '持仓', desc: '账户与交易', to: '/portfolio', icon: BriefcaseBusiness },
  { key: 'backtest', label: '回测', desc: '策略验证', to: '/backtest', icon: BarChart3 },
  { key: 'settings', label: '配置', desc: '系统设置', to: '/settings', icon: Settings2 },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed = false, onNavigate }) => {
  const { authEnabled, logout } = useAuth();
  const completionBadge = useAgentChatStore((state) => state.completionBadge);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* ── Brand ── */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-border/60 px-4',
          'h-14 shrink-0',
          collapsed ? 'justify-center px-0' : ''
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            'border border-[var(--accent-ai-border)] bg-[var(--accent-ai-soft)]',
            'shadow-[0_0_12px_var(--accent-ai-glow)]'
          )}
        >
          <TrendingUp className="h-4 w-4 text-[var(--accent-ai)]" />
        </div>
        {!collapsed ? (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
              AI 投研工作台
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              Daily Stock Analysis
            </p>
          </div>
        ) : null}
      </div>

      {/* ── Nav Items ── */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label="主导航">
        {NAV_ITEMS.map(({ key, label, desc, to, icon: Icon, exact, badge }) => (
          <NavLink
            key={key}
            to={to}
            end={exact}
            onClick={onNavigate}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 text-sm transition-all duration-150',
                'h-[2.625rem]',
                collapsed ? 'justify-center px-2' : '',
                isActive
                  ? 'bg-[var(--nav-active-bg)] text-[var(--accent-ai)] font-medium'
                  : 'text-muted-foreground hover:bg-[var(--nav-hover-bg)] hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active indicator bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
                      'bg-[var(--accent-ai)] shadow-[0_0_8px_var(--accent-ai-glow)]'
                    )}
                    initial={{ opacity: 0, scaleY: 0.6 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{ duration: 0.18 }}
                  />
                )}

                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive ? 'text-[var(--accent-ai)]' : 'text-current'
                  )}
                />

                {!collapsed ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] leading-tight">{label}</p>
                    {!isActive && (
                      <p className="truncate text-[10px] text-muted-foreground/70 leading-tight">
                        {desc}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Completion badge */}
                {badge === 'completion' && completionBadge ? (
                  <StatusDot
                    tone="info"
                    data-testid="chat-completion-badge"
                    className={cn(
                      'absolute border-2 border-background shadow-[0_0_8px_var(--accent-ai-glow)]',
                      collapsed ? 'right-1 top-1' : 'right-3'
                    )}
                    aria-label="问股有新消息"
                  />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom: Theme + Logout ── */}
      <div
        className={cn(
          'flex shrink-0 flex-col gap-1 border-t border-border/60 px-2 py-3',
          collapsed ? 'items-center' : ''
        )}
      >
        <ThemeToggle variant="nav" collapsed={collapsed} />

        {authEnabled ? (
          <button
            type="button"
            aria-label="退出"
            onClick={() => setShowLogoutConfirm(true)}
            className={cn(
              'flex h-10 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-[13px]',
              'text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive',
              collapsed ? 'justify-center px-2' : ''
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>退出登录</span> : null}
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="退出登录"
        message="确认退出当前登录状态吗？退出后需要重新输入密码。"
        confirmText="确认退出"
        cancelText="取消"
        isDanger
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onNavigate?.();
          void logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};
