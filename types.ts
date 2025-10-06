import type { ReactNode } from 'react';
export type Page = 'dashboard' | 'orders' | 'clients' | 'products' | 'transactions' | 'log' | 'settings' | 'reports';

export interface Client {
  id: string;
  displayId: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  etransfer?: string;
  orders: number;
  totalSpent: number;
  inactive?: boolean;
}

export interface ProductTier {
  sizeLabel: string; // "1g", "5ml", "1 unit"
  quantity: number; // 1, 5, 1
  price: number;
}

export interface Product {
  id: string;
  // Optional numeric display ID for privacy-friendly references
  displayId?: number;
  name: string;
  type: 'g' | 'ml' | 'unit';
  stock: number;
  costPerUnit: number;
  increment: number;
  tiers: ProductTier[];
  inactive?: boolean;
  lastOrdered?: string;
  // Optional manual sort index for persistent ordering
  sortIndex?: number;
}


export interface OrderItem {
  productId: string;
  quantity: number; // The actual quantity in base units (g, ml, unit)
  price: number; // The final price for this item (for the whole quantity)
  sizeLabel?: string; // Optional: for display, e.g. "3.5g" or "Custom"
}

export interface PaymentMethods {
  // Store amounts paid per method (in dollars)
  cash: number;        // e.g., 5 means $5 cash
  etransfer: number;   // e.g., 5 means $5 e-transfer
}

export interface OrderAdjustment {
  amount: number;
  description: string;
}

export interface Order {
  id: string;
  // Optional numeric display ID for privacy-friendly references
  displayId?: number;
  clientId: string;
  items: OrderItem[];
  total: number;
  status: 'Draft' | 'Unpaid' | 'Completed';
  date: string;
  notes?: string;
  amountPaid?: number;
  paymentMethods: PaymentMethods;
  fees: OrderAdjustment;
  discount: OrderAdjustment;
  reconciled?: boolean;
}

export interface Metric {
    title: string;
    value: string;
    subtitle: string;
    icon: ReactNode;
    color: string;
}

export interface Expense {
  id: string;
  // Optional numeric display ID for privacy-friendly references
  displayId?: number;
  date: string;
  description: string;
  amount: number;
  category?: string;
  notes?: string;
  // Optional manual sort index for persistent ordering
  sortIndex?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: Record<string, any>;
}

export interface DashboardStat {
    label: string;
    value: string;
    subtext?: string;
}
