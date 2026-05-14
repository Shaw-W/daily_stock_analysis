import type React from 'react';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Drawer } from '../common/Drawer';
import { SidebarNav } from './SidebarNav';
import { ShellHeader } from './ShellHeader';
import { cn } from '../../utils/cn';

type ShellProps = {
  children?: React.ReactNode;
};

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 border-r border-border/60 bg-card/60 backdrop-blur-sm',
          'transition-[width] duration-200 overflow-hidden',
          collapsed ? 'w-[64px]' : 'w-[220px]'
        )}
        aria-label="桌面侧边导航"
      >
        <SidebarNav
          collapsed={collapsed}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>

      {/* ── Right Column: Header + Main ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <ShellHeader
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="flex-1 min-h-0 overflow-auto touch-pan-y">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* ── Mobile Drawer ── */}
      <Drawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="导航菜单"
        width="max-w-xs"
        zIndex={90}
        side="left"
      >
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
      </Drawer>
    </div>
  );
};
