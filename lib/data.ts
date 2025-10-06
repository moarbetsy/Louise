import type { Order, Client, Product, Expense, LogEntry } from '../types';

// Empty defaults keep the UI ready for real data without shipping sample content.

export const demoClients: Client[] = [];

export const demoProducts: Product[] = [];

export const demoOrders: Order[] = [];

export const demoExpenses: Expense[] = [];

export const demoLogs: LogEntry[] = [];

export const initialClients = demoClients;
export const initialProducts = demoProducts;
export const initialOrders = demoOrders;
export const initialExpenses = demoExpenses;
export const initialLogs = demoLogs;

export const demoData = {
  clients: demoClients,
  products: demoProducts,
  orders: demoOrders,
  expenses: demoExpenses,
  logs: demoLogs,
};

export default demoData;
