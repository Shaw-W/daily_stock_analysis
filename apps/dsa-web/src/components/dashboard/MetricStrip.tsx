import type React from 'react';
import { cn } from '../../utils/cn';

type MetricStripProps = {
  children: React.ReactNode;
  className?: string;
};

export const MetricStrip: React.FC<MetricStripProps> = ({ children, className }) => (
  <div
    className={cn(
      'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6',
      className
    )}
  >
    {children}
  </div>
);
