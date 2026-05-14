import type React from 'react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={cn(
      'rounded-2xl border border-dashed border-border/50 bg-card/40 px-6 py-10 text-center',
      'transition-all hover:border-[var(--accent-ai-border)] hover:bg-card/60',
      className
    )}>
      {icon ? (
        <div className="mb-4 flex justify-center text-[var(--accent-ai)] opacity-60">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-md text-[13px] text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
};
