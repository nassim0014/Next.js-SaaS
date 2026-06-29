"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { formatCost, formatTokenCount } from "@/lib/utils";

type DailyUsagePoint = {
  date: string;
  tokens: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
};

type ModelBreakdownPoint = {
  modelConfigId: string;
  provider: string;
  modelName: string;
  tokens: number;
  costUsd: number;
  requestCount: number;
};

const PROVIDER_COLORS: Record<string, string> = {
  google: "#4285F4",
  openai: "#10A37F",
  anthropic: "#D97757",
  groq: "#F55036",
};

const DEFAULT_COLOR = "#8884d8";

function formatChartDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CostTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as DailyUsagePoint;
  if (!data) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-medium">{formatChartDate(data.date)}</p>
      <p className="text-muted-foreground">
        Tokens: <span className="font-medium text-foreground">{formatTokenCount(data.tokens)}</span>
      </p>
      <p className="text-muted-foreground">
        Cost: <span className="font-medium text-foreground">{formatCost(data.costUsd)}</span>
      </p>
      <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
        <p>↑ Input: {formatTokenCount(data.inputTokens)}</p>
        <p>↓ Output: {formatTokenCount(data.outputTokens)}</p>
      </div>
    </div>
  );
}

function ModelTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as ModelBreakdownPoint;
  if (!data) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-medium">{data.modelName}</p>
      <p className="text-muted-foreground capitalize">{data.provider}</p>
      <p className="text-muted-foreground">
        Tokens: <span className="font-medium text-foreground">{formatTokenCount(data.tokens)}</span>
      </p>
      <p className="text-muted-foreground">
        Cost: <span className="font-medium text-foreground">{formatCost(data.costUsd)}</span>
      </p>
      <p className="text-muted-foreground">
        Requests: <span className="font-medium text-foreground">{data.requestCount}</span>
      </p>
    </div>
  );
}

/**
 * Daily token usage + cost chart (area chart, dual-axis).
 * Shows the last 30 days by default.
 */
export function DailyUsageChart({ data }: { data: DailyUsagePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No usage data for this period yet. Send a chat message to see your cost trend.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tickFormatter={formatChartDate}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
          tickFormatter={(v) => formatTokenCount(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
          tickFormatter={(v) => `$${v.toFixed(2)}`}
        />
        <Tooltip content={<CostTooltip />} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="tokens"
          stroke="#8884d8"
          strokeWidth={2}
          fill="url(#tokenGradient)"
          name="Tokens"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="costUsd"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#costGradient)"
          name="Cost (USD)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Pie chart showing token usage distribution across models.
 */
export function ModelBreakdownChart({ data }: { data: ModelBreakdownPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No model usage data for this period yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="tokens"
          nameKey="modelName"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={40}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell
              key={entry.modelConfigId}
              fill={PROVIDER_COLORS[entry.provider] ?? DEFAULT_COLOR}
            />
          ))}
        </Pie>
        <Tooltip content={<ModelTooltip />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value: string, _entry, index) => {
            const point = data[index];
            if (!point) return value;
            return (
              <span className="text-xs">
                {value} ({formatCost(point.costUsd)})
              </span>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export type { DailyUsagePoint, ModelBreakdownPoint };
