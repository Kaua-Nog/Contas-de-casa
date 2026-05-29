export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  category: string;
  checked: boolean;
  date?: string; // Format: "YYYY-MM-DD"
  concluded?: boolean;
}

export type BillType = 'agua' | 'energia' | 'racao_gatos' | 'racao_cachorro' | 'outros';

export interface HouseBill {
  id: string;
  type: BillType;
  customTitle?: string;
  value: number;
  month: string; // Format: "AAAA-MM" (e.g., "2026-05")
  dueDate: string; // ISO date string "YYYY-MM-DD"
  paid: boolean;
}

export interface MonthlySummary {
  month: string; // "AAAA-MM"
  monthName: string; // e.g. "Maio"
  paid: number;
  pending: number;
  total: number;
}
