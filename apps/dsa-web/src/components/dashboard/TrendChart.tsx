import type React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

export type TrendDataPoint = {
  date: string;
  count: number;
};

type TrendChartProps = {
  data: TrendDataPoint[];
  height?: number;
  color?: string;
  type?: 'line' | 'area';
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card/95 px-3 py-2 shadow-lg text-[12px]">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{payload[0].value}</p>
    </div>
  );
};

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  height = 200,
  color = 'hsl(160 84% 45%)',
  type = 'area',
}) => {
  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(0 0% 100% / 0.1)' }} />
          <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(0 0% 100% / 0.1)' }} />
        <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fill="url(#trendGradient)" dot={false} activeDot={{ r: 4, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  );
};
