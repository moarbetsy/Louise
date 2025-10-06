import { fetchAllFromSupabase } from './db';
import demoData from './data';
import type { Client, Expense, LogEntry, Order, Product } from '../types';

export type DataBundle = {
  clients: Client[];
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  logs: LogEntry[];
};

const EMPTY: DataBundle = {
  clients: [],
  products: [],
  orders: [],
  expenses: [],
  logs: [],
};

const hasAnyRows = (payload: Partial<DataBundle> | null): payload is DataBundle => {
  if (!payload) return false;
  return Boolean(
    (payload.clients && payload.clients.length) ||
    (payload.products && payload.products.length) ||
    (payload.orders && payload.orders.length) ||
    (payload.expenses && payload.expenses.length) ||
    (payload.logs && payload.logs.length)
  );
};

const normalizeBundle = (payload: Partial<DataBundle> | null | undefined): DataBundle => ({
  clients: [...(payload?.clients ?? [])],
  products: [...(payload?.products ?? [])],
  orders: [...(payload?.orders ?? [])],
  expenses: [...(payload?.expenses ?? [])],
  logs: [...(payload?.logs ?? [])],
});

export type LoadInitialDataResult = {
  source: 'supabase' | 'demo' | 'empty';
  data: DataBundle;
};

/**
 * Loads the initial dataset. When Supabase env variables are present the app will
 * pull remote rows; otherwise, fall back to the bundled demo data to keep the UI functional.
 */
export async function loadInitialData(): Promise<LoadInitialDataResult> {
  const remote = await fetchAllFromSupabase();
  if (hasAnyRows(remote)) {
    return { source: 'supabase', data: normalizeBundle(remote) };
  }

  if (hasAnyRows(demoData)) {
    return { source: 'demo', data: normalizeBundle(demoData) };
  }

  return { source: 'empty', data: EMPTY };
}
