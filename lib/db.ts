import type { Client, Product, Order, Expense, LogEntry, OrderItem, ProductTier, PaymentMethods } from '../types';
import { supabase } from './supabase';

type TableName = 'clients' | 'products' | 'orders' | 'expenses' | 'logs';

const tableFor = (name: TableName) => supabase!.from(name);

// Detect whether the database is using the normalized (Option B) schema.
let normalizedMode: boolean | null = null;
async function ensureMode() {
  if (!supabase) return false;
  if (normalizedMode !== null) return normalizedMode;
  try {
    const { error } = await supabase.from('product_tiers').select('id').limit(1);
    normalizedMode = !error;
  } catch {
    normalizedMode = false;
  }
  return normalizedMode;
}

// ---------- Mapping helpers (Option B normalized) ----------

function fromDbClient(row: any): Client {
  return {
    id: String(row.id),
    displayId: row.display_id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    etransfer: row.etransfer ?? undefined,
    notes: row.notes ?? undefined,
    inactive: Boolean(row.inactive ?? false),
    // Derived in UI; keep zero here
    orders: 0,
    totalSpent: 0,
  };
}

function toDbClient(row: Partial<Client>) {
  return {
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address ?? null,
    etransfer: row.etransfer ?? null,
    notes: row.notes ?? null,
    inactive: row.inactive ?? false,
  } as const;
}

function fromDbProduct(row: any, tiers: any[] | undefined): Product {
  const mappedTiers: ProductTier[] = (tiers || []).map(t => ({
    sizeLabel: t.size_label,
    quantity: Number(t.quantity),
    price: Number(t.price),
  }));
  return {
    id: String(row.id),
    displayId: row.display_id ?? undefined,
    name: row.name,
    type: row.type,
    stock: Number(row.stock ?? 0),
    costPerUnit: Number(row.cost_per_unit ?? 0),
    increment: Number(row.increment ?? 1),
    tiers: mappedTiers,
    inactive: Boolean(row.inactive ?? false),
    lastOrdered: row.last_ordered ?? undefined,
  };
}

function toDbProduct(row: Partial<Product>) {
  return {
    name: row.name,
    type: row.type,
    stock: row.stock ?? 0,
    cost_per_unit: row.costPerUnit ?? 0,
    increment: row.increment ?? 1,
    inactive: row.inactive ?? false,
    last_ordered: row.lastOrdered ?? null,
  } as const;
}

function fromDbOrder(row: any, items: any[]): Order {
  const mappedItems: OrderItem[] = (items || []).map(i => ({
    productId: String(i.product_id),
    quantity: Number(i.quantity),
    price: Number(i.line_price),
    sizeLabel: i.size_label ?? undefined,
  }));

  const rawPaymentMethods = (row.payment_methods || {}) as Record<string, unknown>;
  const paymentMethods: PaymentMethods = {
    cash: Number(rawPaymentMethods.cash ?? 0) || 0,
    etransfer: Number(rawPaymentMethods.etransfer ?? 0) || 0,
  };
  const rawDueDate = typeof rawPaymentMethods.dueDate === 'string' ? rawPaymentMethods.dueDate : undefined;
  if (rawDueDate) {
    paymentMethods.dueDate = rawDueDate;
  }
  const paymentDueDate = typeof row.payment_due_date === 'string' && row.payment_due_date.length
    ? row.payment_due_date
    : rawDueDate;

  return {
    id: String(row.id),
    displayId: row.display_id ?? undefined,
    clientId: String(row.client_id),
    date: row.date,
    items: mappedItems,
    total: Number(row.total),
    status: row.status,
    notes: row.notes ?? undefined,
    amountPaid: row.amount_paid != null ? Number(row.amount_paid) : undefined,
    paymentMethods,
    fees: row.fees_json ?? { amount: 0, description: '' },
    discount: row.discount_json ?? { amount: 0, description: '' },
    paymentDueDate: paymentDueDate ?? undefined,
  };
}

function toDbOrder(row: Partial<Order>) {
  const basePaymentMethods = (row.paymentMethods as PaymentMethods | undefined) ?? undefined;
  let paymentMethodsPayload: Record<string, unknown> | null = null;

  const normalizedCash = Number(basePaymentMethods?.cash ?? 0) || 0;
  const normalizedEtransfer = Number(basePaymentMethods?.etransfer ?? 0) || 0;
  const effectiveDueDate =
    typeof row.paymentDueDate === 'string' && row.paymentDueDate.length
      ? row.paymentDueDate
      : (typeof basePaymentMethods?.dueDate === 'string' && basePaymentMethods?.dueDate.length
          ? basePaymentMethods.dueDate
          : undefined);

  if (basePaymentMethods || normalizedCash || normalizedEtransfer || effectiveDueDate) {
    paymentMethodsPayload = {
      cash: normalizedCash,
      etransfer: normalizedEtransfer,
    };
    if (effectiveDueDate) {
      paymentMethodsPayload.dueDate = effectiveDueDate;
    }
  }

  return {
    client_id: row.clientId,
    date: row.date,
    amount_paid: row.amountPaid ?? 0,
    total: row.total,
    status: row.status,
    fees_json: row.fees ?? null,
    discount_json: row.discount ?? null,
    payment_methods: paymentMethodsPayload,
    notes: row.notes ?? null,
  } as const;
}

function fromDbExpense(row: any): Expense {
  return {
    id: String(row.id),
    displayId: row.display_id ?? undefined,
    date: row.date,
    description: row.description,
    amount: Number(row.amount),
    category: row.category ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function toDbExpense(row: Partial<Expense>) {
  return {
    date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category ?? null,
    notes: row.notes ?? null,
  } as const;
}

export async function fetchAllFromSupabase() {
  if (!supabase) return null;

  // Try normalized Option B first; if it fails, fall back to Option A.
  try {
    const normalized = await ensureMode();
    if (normalized) {
      const [c, p, pt, o, oi, e, l] = await Promise.all([
        supabase.from('clients').select('id, display_id, name, email, phone, address, etransfer, notes, inactive'),
        supabase.from('products').select('id, display_id, name, type, stock, cost_per_unit, increment, inactive, last_ordered'),
        supabase.from('product_tiers').select('id, product_id, size_label, quantity, price'),
        supabase.from('orders').select('id, display_id, client_id, date, amount_paid, total, status, fees_json, discount_json, payment_methods, notes'),
        supabase.from('order_items').select('id, order_id, product_id, size_label, quantity, unit_price, line_price'),
        supabase.from('expenses').select('id, display_id, date, description, amount, category, notes'),
        supabase.from('logs').select('id, timestamp, user, action, details').order('timestamp', { ascending: false }),
      ]);

      if (c.error || p.error || pt.error || o.error || oi.error || e.error || l.error) {
        console.warn('Supabase normalized fetch error(s):', { c: c.error, p: p.error, pt: pt.error, o: o.error, oi: oi.error, e: e.error, l: l.error });
        throw new Error('Normalized fetch failed');
      }

      const tiersByProduct = new Map<string, any[]>();
      (pt.data || []).forEach((t: any) => {
        const key = String(t.product_id);
        const arr = tiersByProduct.get(key) || [];
        arr.push(t);
        tiersByProduct.set(key, arr);
      });

      const itemsByOrder = new Map<string, any[]>();
      (oi.data || []).forEach((it: any) => {
        const key = String(it.order_id);
        const arr = itemsByOrder.get(key) || [];
        arr.push(it);
        itemsByOrder.set(key, arr);
      });

      const clients = (c.data || []).map(fromDbClient);
      const products = (p.data || []).map((row: any) => fromDbProduct(row, tiersByProduct.get(String(row.id))));
      const orders = (o.data || []).map((row: any) => fromDbOrder(row, itemsByOrder.get(String(row.id)) || []));
      const expenses = (e.data || []).map(fromDbExpense);
      const logs = ((l.data || []) as any[]).map((r) => ({
        id: String(r.id),
        timestamp: r.timestamp,
        user: r.user,
        action: r.action,
        details: r.details || {},
      })) as LogEntry[];

      return { clients, products, orders, expenses, logs };
    }
  } catch {
    // Fall through to Option A
  }

  // Option A fallback (legacy flat tables with camelCase columns)
  const [clients, products, orders, expenses, logs] = await Promise.all([
    tableFor('clients').select('*'),
    tableFor('products').select('*'),
    tableFor('orders').select('*'),
    tableFor('expenses').select('*'),
    tableFor('logs').select('*').order('timestamp', { ascending: false }),
  ]);

  if (clients.error || products.error || orders.error || expenses.error || logs.error) {
    console.warn('Supabase fetch error(s):', { clients: clients.error, products: products.error, orders: orders.error, expenses: expenses.error, logs: logs.error });
    return null;
  }

  const legacyOrders = ((orders.data as Order[]) ?? []).map(order => {
    if (!order) return order;
    const existingDue =
      typeof (order as any).paymentDueDate === 'string' && (order as any).paymentDueDate.length
        ? (order as any).paymentDueDate
        : undefined;
    if (existingDue) return order;
    const payments = (order as any).paymentMethods as PaymentMethods | undefined;
    const dueDate =
      payments && typeof payments === 'object' && typeof (payments as any).dueDate === 'string' && (payments as any).dueDate.length
        ? (payments as any).dueDate
        : undefined;
    return dueDate ? ({ ...order, paymentDueDate: dueDate } as Order) : order;
  });

  return {
    clients: (clients.data as Client[]) ?? [],
    products: (products.data as Product[]) ?? [],
    orders: legacyOrders,
    expenses: (expenses.data as Expense[]) ?? [],
    logs: (logs.data as LogEntry[]) ?? [],
  };
}

// Upsert a single row and (when Supabase is enabled) return the stored row.
// Callers in the app often ignore the return value today; returning data
// keeps a path open to adopt DB-managed fields later with minimal changes.
export async function upsertRow<T extends { id: string }>(table: TableName, row: T): Promise<T | undefined> {
  if (!supabase) return undefined;
  const normalized = await ensureMode();

  if (normalized) {
    try {
      if (table === 'clients') {
        const { data, error } = await supabase
          .from('clients')
          .update(toDbClient(row))
          .eq('id', row.id)
          .select('id, display_id, name, email, phone, address, etransfer, notes, inactive')
          .single();
        if (error) throw error;
        return fromDbClient(data) as unknown as T;
      }
      if (table === 'products') {
        const { data, error } = await supabase
          .from('products')
          .update(toDbProduct(row))
          .eq('id', row.id)
          .select('id, display_id, name, type, stock, cost_per_unit, increment, inactive, last_ordered')
          .single();
        if (error) throw error;

        // Replace tiers
        if (Array.isArray((row as any).tiers)) {
          await supabase.from('product_tiers').delete().eq('product_id', row.id);
          const tiersRows = ((row as any).tiers as ProductTier[]).map(t => ({
            product_id: row.id,
            size_label: t.sizeLabel,
            quantity: t.quantity,
            price: t.price,
          }));
          if (tiersRows.length) await supabase.from('product_tiers').insert(tiersRows);
        }

        // Fetch tiers back
        const tiers = await supabase
          .from('product_tiers')
          .select('id, product_id, size_label, quantity, price')
          .eq('product_id', row.id);
        if (tiers.error) throw tiers.error;
        const mapped = fromDbProduct(data, tiers.data || []);
        return mapped as unknown as T;
      }
      if (table === 'orders') {
        const core = toDbOrder(row);
        const { data, error } = await supabase
          .from('orders')
          .update(core)
          .eq('id', row.id)
          .select('id, display_id, client_id, date, amount_paid, total, status, fees_json, discount_json, payment_methods, notes')
          .single();
        if (error) throw error;

        // Replace items
        await supabase.from('order_items').delete().eq('order_id', row.id);
        const itemsRows = ((row as any).items as OrderItem[]).map(i => ({
          order_id: row.id,
          product_id: i.productId,
          size_label: i.sizeLabel ?? null,
          quantity: i.quantity,
          unit_price: i.quantity ? Math.round((i.price / i.quantity) * 100) / 100 : i.price,
          line_price: i.price,
        }));
        if (itemsRows.length) await supabase.from('order_items').insert(itemsRows);

        const items = await supabase
          .from('order_items')
          .select('id, order_id, product_id, size_label, quantity, unit_price, line_price')
          .eq('order_id', row.id);
        if (items.error) throw items.error;
        return fromDbOrder(data, items.data || []) as unknown as T;
      }
      if (table === 'expenses') {
        const { data, error } = await supabase
          .from('expenses')
          .update(toDbExpense(row))
          .eq('id', row.id)
          .select('id, display_id, date, description, amount, category, notes')
          .single();
        if (error) throw error;
        return fromDbExpense(data) as unknown as T;
      }
      if (table === 'logs') {
        const { data, error } = await supabase
          .from('logs')
          .update({
            timestamp: (row as any).timestamp,
            user: (row as any).user,
            action: (row as any).action,
            details: (row as any).details ?? {},
          })
          .eq('id', row.id)
          .select('id, timestamp, user, action, details')
          .single();
        if (error) throw error;
        return ({
          id: String(data.id),
          timestamp: data.timestamp,
          user: data.user,
          action: data.action,
          details: data.details || {},
        } as unknown) as T;
      }
    } catch (e) {
      console.error(`Supabase normalized upsert error in ${table}`, e);
      return undefined;
    }
  }

  // Legacy Option A
  const payload = (() => {
    if (table !== 'orders') return row as any;
    const { paymentDueDate, paymentMethods, ...rest } = row as any;
    const nextPaymentMethods: Record<string, unknown> = {
      cash: Number(paymentMethods?.cash ?? 0) || 0,
      etransfer: Number(paymentMethods?.etransfer ?? 0) || 0,
    };
    const effectiveDue =
      typeof paymentDueDate === 'string' && paymentDueDate.length
        ? paymentDueDate
        : (typeof paymentMethods?.dueDate === 'string' && paymentMethods.dueDate.length
            ? paymentMethods.dueDate
            : undefined);
    if (effectiveDue) {
      nextPaymentMethods.dueDate = effectiveDue;
    }
    return {
      ...rest,
      paymentMethods: nextPaymentMethods,
    };
  })();

  const { data, error } = await tableFor(table).upsert(payload).select().single();
  if (error) {
    console.error(`Supabase upsert error in ${table}`, error);
    return undefined;
  }
  return data as T | undefined;
}

export async function deleteById(table: TableName, id: string) {
  if (!supabase) return;
  const normalized = await ensureMode();
  // For normalized schema, cascades are already defined for order_items; simple delete works
  const { error } = await (normalized ? supabase.from(table) : tableFor(table)).delete().eq('id', id);
  if (error) console.error(`Supabase delete error in ${table}`, error);
}

// Bulk sync helper: upserts all local entities into Supabase in efficient batches.
// Safe to call repeatedly; uses id as upsert conflict key.
export async function syncLocalToSupabase(payload: {
  clients: Client[];
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  logs: LogEntry[];
}) {
  if (!supabase) return { enabled: false } as const;

  const normalized = await ensureMode();
  if (!normalized) {
    // Legacy Option A bulk upsert
    const CHUNK = 500;
    const upsertAll = async <T>(name: TableName, rows: T[]) => {
      let ok = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error, count } = await tableFor(name).upsert(slice as any, { count: 'exact' });
        if (error) {
          console.error(`Supabase bulk upsert error in ${name}`, error);
        } else if (count != null) {
          ok += count;
        } else {
          ok += slice.length;
        }
      }
      return ok;
    };

    const [c, p, o, e, l] = await Promise.all([
      upsertAll('clients', payload.clients),
      upsertAll('products', payload.products),
      upsertAll('orders', payload.orders),
      upsertAll('expenses', payload.expenses),
      upsertAll('logs', payload.logs),
    ]);

    return { enabled: true, counts: { clients: c, products: p, orders: o, expenses: e, logs: l } } as const;
  }

  // For normalized schema, automated migration is non-trivial because new UUIDs
  // must be propagated across relations. Provide counts=0 and require manual migration.
  return { enabled: true, counts: { clients: 0, products: 0, orders: 0, expenses: 0, logs: 0 } } as const;
}

// ---------- Create helpers (Option B) ----------

export async function createClientNormalized(input: Omit<Client, 'id' | 'displayId' | 'orders' | 'totalSpent'>): Promise<Client | undefined> {
  if (!supabase) return undefined;
  const normalized = await ensureMode();
  if (!normalized) return undefined;
  const { data, error } = await supabase
    .from('clients')
    .insert(toDbClient(input))
    .select('id, display_id, name, email, phone, address, etransfer, notes, inactive')
    .single();
  if (error) {
    console.error('Supabase insert client error', error);
    return undefined;
  }
  return fromDbClient(data);
}

export async function createProductNormalized(input: Omit<Product, 'id' | 'displayId' | 'sortIndex'>): Promise<Product | undefined> {
  if (!supabase) return undefined;
  const normalized = await ensureMode();
  if (!normalized) return undefined;
  const { tiers, ...rest } = input;
  const { data, error } = await supabase
    .from('products')
    .insert(toDbProduct(rest))
    .select('id, display_id, name, type, stock, cost_per_unit, increment, inactive, last_ordered')
    .single();
  if (error) {
    console.error('Supabase insert product error', error);
    return undefined;
  }
  const productId = data.id as string;
  if (Array.isArray(tiers) && tiers.length) {
    const rows = tiers.map(t => ({ product_id: productId, size_label: t.sizeLabel, quantity: t.quantity, price: t.price }));
    const ins = await supabase.from('product_tiers').insert(rows).select('id, product_id, size_label, quantity, price');
    if (ins.error) {
      console.error('Supabase insert product_tiers error', ins.error);
    }
  }
  const tiersRes = await supabase
    .from('product_tiers')
    .select('id, product_id, size_label, quantity, price')
    .eq('product_id', productId);
  const mapped = fromDbProduct(data, tiersRes.data || []);
  return mapped;
}

export async function createOrderNormalized(input: Omit<Order, 'id' | 'displayId'>): Promise<Order | undefined> {
  if (!supabase) return undefined;
  const normalized = await ensureMode();
  if (!normalized) return undefined;
  const core = toDbOrder(input);
  const { data, error } = await supabase
    .from('orders')
    .insert(core)
    .select('id, display_id, client_id, date, amount_paid, total, status, fees_json, discount_json, payment_methods, notes')
    .single();
  if (error) {
    console.error('Supabase insert order error', error);
    return undefined;
  }
  const orderId = data.id as string;
  const itemsRows = (input.items || []).map(i => ({
    order_id: orderId,
    product_id: i.productId,
    size_label: i.sizeLabel ?? null,
    quantity: i.quantity,
    unit_price: i.quantity ? Math.round((i.price / i.quantity) * 100) / 100 : i.price,
    line_price: i.price,
  }));
  if (itemsRows.length) {
    const ins = await supabase.from('order_items').insert(itemsRows);
    if (ins.error) console.error('Supabase insert order_items error', ins.error);
  }
  const items = await supabase
    .from('order_items')
    .select('id, order_id, product_id, size_label, quantity, unit_price, line_price')
    .eq('order_id', orderId);
  if (items.error) {
    console.error('Supabase fetch order_items error', items.error);
  }
  return fromDbOrder(data, items.data || []);
}

export async function createExpenseNormalized(input: Omit<Expense, 'id' | 'displayId' | 'sortIndex'>): Promise<Expense | undefined> {
  if (!supabase) return undefined;
  const normalized = await ensureMode();
  if (!normalized) return undefined;
  const { data, error } = await supabase
    .from('expenses')
    .insert(toDbExpense(input))
    .select('id, display_id, date, description, amount, category, notes')
    .single();
  if (error) {
    console.error('Supabase insert expense error', error);
    return undefined;
  }
  return fromDbExpense(data);
}

export async function createLogNormalized(input: Omit<LogEntry, 'id'>): Promise<LogEntry | undefined> {
  if (!supabase) return undefined;
  const normalized = await ensureMode();
  if (!normalized) return undefined;
  const { data, error } = await supabase
    .from('logs')
    .insert({ timestamp: input.timestamp, user: input.user, action: input.action, details: input.details ?? {} })
    .select('id, timestamp, user, action, details')
    .single();
  if (error) {
    console.error('Supabase insert log error', error);
    return undefined;
  }
  return { id: String(data.id), timestamp: data.timestamp, user: data.user, action: data.action, details: data.details || {} };
}
