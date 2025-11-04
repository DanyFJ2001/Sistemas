export interface DashboardStats {
  approved: number;
  rejected: number;
  review: number;
  pending: number;
  total: number;
  totalAmount: number;
  emailsSent: number;
  chartData?: ChartData;
}

export interface ChartData {
  labels: string[];
  approved: number[];
  rejected: number[];
  review: number[];
}