import type React from 'react';
import { cn } from '../../utils/cn';

export type QuickAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: 'ai' | 'default';
  disabled?: boolean;
};

type QuickActionsProps = {
  actions: QuickAction[];
  className?: string;
};

export const QuickActions: React.FC<QuickActionsProps> = ({ actions, className }) => (
  <div className={cn('flex flex-wrap gap-2', className)}>
    {actions.map((action) => (
      <button
        key={action.key}
        type="button"
        disabled={action.disabled}
        onClick={action.onClick}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium',
          'transition-all duration-150',
          action.tone === 'ai'
            ? [
                'border-[var(--accent-ai-border)] bg-[var(--accent-ai-soft)] text-[var(--accent-ai)]',
                'hover:bg-[var(--accent-ai-soft)] hover:shadow-[0_0_12px_var(--accent-ai-glow)]',
              ]
            : [
                'border-border/60 bg-card/60 text-muted-foreground',
                'hover:border-[var(--accent-ai-border)] hover:text-foreground',
              ],
          action.disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{action.icon}</span>
        {action.label}
      </button>
    ))}
  </div>
);
