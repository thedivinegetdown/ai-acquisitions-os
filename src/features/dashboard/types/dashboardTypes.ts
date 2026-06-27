export type DashboardMetric = {
  label: string;
  value: string | number;
  sub?: string;
};

export type ChartRow = {
  label: string;
  value: number;
};

export type ExecutiveDashboardData = {
  overview: Record<string, number>;
  pipeline: Record<string, unknown>;
  revenue: Record<string, { value: string | number }>;
  performance: Record<string, { value: string | number }>;
  notifications: Record<string, unknown[]>;
  charts: Record<string, ChartRow[]>;
  insights: string[];
  generatedAt: string;
};
