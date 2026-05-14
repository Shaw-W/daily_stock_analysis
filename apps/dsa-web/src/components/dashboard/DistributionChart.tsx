import type React from 'react';
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export type DistributionDataPoint = {
  date: string;       // display label, e.g. "05-07"
  count: number;      // primary value
  debate?: number;    // secondary (debate)
};

type DistributionChartProps = {
  data: DistributionDataPoint[];
  height?: number;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card/95 px-3 py-2 shadow-lg text-[12px]">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="tabular-nums">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export const DistributionChart: React.FC<DistributionChartProps> = ({
  data,
  height = 240,
}) => {
  const hasDebate = useMemo(() => data.some((d) => (d.debate ?? 0) > 0), [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(0 0% 100% / 0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(0 0% 100% / 0.04)' }} />
        {hasDebate && <Legend
          iconType="rect"
          iconSize={10}
          wrapperStyle={{ fontSize: '11px', color: 'hsl(0 0% 50%)' }}
        />}
        <Bar
          dataKey="count"
          name="分析"
          fill="hsl(160 84% 45%)"
          radius={[2, 2, 0, 0]}
          maxBarSize={48}
        />
        {hasDebate && (
          <Bar
            dataKey="debate"
            name="辩论"
            fill="hsl(217 91% 60%)"
            radius={[2, 2, 0, 0]}
            maxBarSize={48}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};
