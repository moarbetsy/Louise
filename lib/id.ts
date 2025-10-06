// Simple ID counters stored in localStorage (and optionally mirrored to Supabase later)
// Keys: next_client_number, next_product_number, next_order_number, next_expense_number

type Entity = 'client' | 'product' | 'order' | 'expense';

type Counters = {
  next_client_number: number;
  next_product_number: number;
  next_order_number: number;
  next_expense_number: number;
};

const STORAGE_KEY = 'id_counters_v1';

function loadCounters(): Counters {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Counters>;
      return {
        next_client_number: parsed.next_client_number ?? 1,
        next_product_number: parsed.next_product_number ?? 1,
        next_order_number: parsed.next_order_number ?? 1,
        next_expense_number: parsed.next_expense_number ?? 1,
      };
    } catch {}
  }
  return { next_client_number: 1, next_product_number: 1, next_order_number: 1, next_expense_number: 1 };
}

function saveCounters(counters: Counters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
}

// Initialize counters based on current data, ensuring we never reuse a display ID.
export function initCountersFromData(opts: {
  maxClientDisplayId?: number;
  maxProductDisplayId?: number;
  maxOrderDisplayId?: number;
  maxExpenseDisplayId?: number;
}) {
  const counters = loadCounters();
  const updated: Counters = { ...counters };
  if (opts.maxClientDisplayId !== undefined) {
    if (opts.maxClientDisplayId <= 0) {
      updated.next_client_number = 1;
    } else {
      updated.next_client_number = Math.max(updated.next_client_number, opts.maxClientDisplayId + 1);
    }
  }
  if (opts.maxProductDisplayId !== undefined) {
    if (opts.maxProductDisplayId <= 0) {
      updated.next_product_number = 1;
    } else {
      updated.next_product_number = Math.max(updated.next_product_number, opts.maxProductDisplayId + 1);
    }
  }
  if (opts.maxOrderDisplayId !== undefined) {
    if (opts.maxOrderDisplayId <= 0) {
      updated.next_order_number = 1;
    } else {
      updated.next_order_number = Math.max(updated.next_order_number, opts.maxOrderDisplayId + 1);
    }
  }
  if (opts.maxExpenseDisplayId !== undefined) {
    if (opts.maxExpenseDisplayId <= 0) {
      updated.next_expense_number = 1;
    } else {
      updated.next_expense_number = Math.max(updated.next_expense_number, opts.maxExpenseDisplayId + 1);
    }
  }
  saveCounters(updated);
}

export function getNextDisplayId(entity: Entity): number {
  const counters = loadCounters();
  const key = `next_${entity}_number` as const;
  const n = counters[key];
  const next = n + 1;
  saveCounters({ ...counters, [key]: next } as Counters);
  return n; // return current value, then increment for next call
}
