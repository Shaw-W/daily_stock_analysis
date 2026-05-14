import React from 'react';
import { cn } from '../../utils/cn';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'history'
  | 'ai'
  | 'market-up'
  | 'market-down';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'border-border/55 bg-elevated/75 text-secondary-text',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  danger: 'border-danger/20 bg-danger/10 text-danger',
  info: 'border-primary/25 bg-primary/10 text-primary',
  history: 'border-purple/20 bg-purple/10 text-purple',
  ai: 'border-[var(--accent-ai-border)] bg-[var(--accent-ai-soft)] text-[var(--accent-ai)]',
  'market-up': 'border-[var(--market-up)]/20 bg-[var(--market-up)]/10 text-[var(--market-up)]',
  'market-down': 'border-[var(--market-down)]/20 bg-[var(--market-down)]/10 text-[var(--market-down)]',
};

const glowStyles: Record<BadgeVariant, string> = {
  default: '',
  success: 'shadow-success/20',
  warning: 'shadow-warning/20',
  danger: 'shadow-danger/20',
  info: 'shadow-primary/20',
  history: 'shadow-purple/20',
  ai: 'shadow-[var(--accent-ai-glow)]',
  'market-up': '',
  'market-down': '',
};

/**
 * Badge component with multiple variants and optional glow styling.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  glow = false,
  className = '',
  style,
  ...rest
}) => {
  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      {...rest}
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium backdrop-blur-sm',
        sizeStyles,
        variantStyles[variant],
        glow && `shadow-lg ${glowStyles[variant]}`,
        className,
      )}
    >
      {children}
    </span>
  );
};
