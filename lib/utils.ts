import type { Product, OrderItem, Client, ProductTier } from '../types';

type EntityForDisplay = 'client' | 'product' | 'order' | 'expense';

type FormatEntityDisplayIdOptions = {
  includeEntityPrefix?: boolean;
};

const DISPLAY_ID_PREFIX: Record<EntityForDisplay, string> = {
  client: 'Client',
  product: 'Product',
  order: 'Order',
  expense: 'Expense',
};

const DISPLAY_ID_PAD_LENGTH: Record<EntityForDisplay, number> = {
  client: 3,
  product: 2,
  order: 4,
  expense: 4,
};

export function formatEntityDisplayId(
  entity: EntityForDisplay,
  displayId?: number | null,
  fallback?: string,
  options?: FormatEntityDisplayIdOptions
): string {
  if (displayId == null) {
    return fallback ?? '';
  }
  const prefix = DISPLAY_ID_PREFIX[entity];
  const padLength = DISPLAY_ID_PAD_LENGTH[entity];
  const padded = String(displayId).padStart(padLength, '0');
  const includePrefix = options?.includeEntityPrefix ?? true;
  return includePrefix ? `${prefix} #${padded}` : `#${padded}`;
}

export function calculateTieredPrice(
  tiers: ProductTier[] | undefined,
  quantity: number,
  fallbackPerUnit?: number
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  const validTiers = (tiers ?? [])
    .map(tier => ({
      ...tier,
      quantity: Number(tier.quantity),
      price: Number(tier.price),
    }))
    .filter(tier => Number.isFinite(tier.quantity) && tier.quantity > 0 && Number.isFinite(tier.price) && tier.price > 0);

  if (validTiers.length === 0) {
    const perUnit = Number.isFinite(fallbackPerUnit) && (fallbackPerUnit ?? 0) > 0
      ? fallbackPerUnit as number
      : 0;
    return Math.round(quantity * perUnit * 100) / 100;
  }

  const tiersByQuantityDesc = [...validTiers].sort((a, b) => b.quantity - a.quantity);
  const epsilon = 1e-6;
  let remaining = quantity;
  let total = 0;

  for (const tier of tiersByQuantityDesc) {
    if (remaining + epsilon < tier.quantity) {
      continue;
    }
    const count = Math.floor((remaining + epsilon) / tier.quantity);
    if (count <= 0) {
      continue;
    }
    total += count * tier.price;
    remaining -= count * tier.quantity;
    if (remaining <= epsilon) {
      remaining = 0;
      break;
    }
  }

  if (remaining > epsilon) {
    const smallestTier = validTiers.reduce((smallest, candidate) =>
      candidate.quantity < smallest.quantity ? candidate : smallest
    );
    const perUnit = smallestTier.price / smallestTier.quantity;
    total += remaining * perUnit;
  }

  return Math.round(total * 100) / 100;
}

export function calculateCost(product: Product, quantity: number): number {
  if (!product || quantity <= 0) return 0;
  
  // The new Product type has costPerUnit directly.
  return product.costPerUnit * quantity;
}

export function exportToCsv(filename: string, rows: object[]): boolean {
  if (rows.length === 0) {
    return false;
  }

  const replacer = (_key: any, value: any) => value === null || value === undefined ? '' : value;
  const header = Object.keys(rows[0]);
  const csv = [
    header.join(','),
    ...rows.map(row => header.map(fieldName => JSON.stringify((row as any)[fieldName], replacer)).join(','))
  ].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  return true;
}

export type GroupedOrderItem = {
  productId: string;
  sizeKey: string; // identity for the size (tier label or normalized qty+unit)
  displayQty: string; // what to show to the user
  count: number; // how many identical lines
  totalPrice: number; // sum of line prices for identical lines
};

// Group identical order items (same product and size) into a single row with xN multiplier.
// Size identity prefers tier `sizeLabel` when present and not 'Custom', otherwise uses normalized quantity+unit.
export function groupOrderItems(items: OrderItem[], products: Product[]): GroupedOrderItem[] {
  const list: GroupedOrderItem[] = [];
  const index: Record<string, number> = {};

  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    const unit = product?.type ?? '';
    const hasTierLabel = item.sizeLabel && item.sizeLabel.toLowerCase() !== 'custom';
    const normalizedQty = unit === 'g' ? item.quantity.toFixed(2) : String(Math.round(item.quantity));
    const displayQty = hasTierLabel ? (item.sizeLabel as string) : `${normalizedQty}${unit}`;
    const sizeKey = hasTierLabel ? (item.sizeLabel as string) : `${normalizedQty}${unit}`;
    const key = `${item.productId}|${sizeKey}`;

    if (index[key] !== undefined) {
      const i = index[key];
      list[i].count += 1;
      list[i].totalPrice += item.price || 0;
    } else {
      index[key] = list.length;
      list.push({
        productId: item.productId,
        sizeKey,
        displayQty,
        count: 1,
        totalPrice: item.price || 0,
      });
    }
  }

  return list;
}

type ClientNameEntry = {
  id: string;
  words: string[];
  full: string;
};

export function buildClientShortNameMap(clients: Client[]): Record<string, string> {
  const entries: ClientNameEntry[] = clients
    .map(client => {
      const full = (client.name ?? '').trim();
      if (!full) return null;
      const words = full.split(/\s+/).filter(Boolean);
      if (words.length === 0) return null;
      return { id: client.id, words, full };
    })
    .filter((entry): entry is ClientNameEntry => Boolean(entry));

  if (entries.length === 0) {
    return {};
  }

  const prefixLengths = new Map<string, number>();
  const entryById = new Map<string, ClientNameEntry>();

  for (const entry of entries) {
    entryById.set(entry.id, entry);
    prefixLengths.set(entry.id, Math.min(1, entry.words.length));
  }

  let changed = true;
  while (changed) {
    changed = false;

    const groups = new Map<string, string[]>();
    for (const entry of entries) {
      const currentLength = prefixLengths.get(entry.id) ?? entry.words.length;
      const sliceLength = Math.min(currentLength, entry.words.length);
      const label = entry.words.slice(0, sliceLength).join(' ');
      const key = label.toLowerCase();
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(entry.id);
      } else {
        groups.set(key, [entry.id]);
      }
    }

    for (const ids of groups.values()) {
      if (ids.length <= 1) continue;

      for (const id of ids) {
        const entry = entryById.get(id);
        if (!entry) continue;
        const currentLength = prefixLengths.get(id) ?? entry.words.length;
        if (currentLength < entry.words.length) {
          prefixLengths.set(id, currentLength + 1);
          changed = true;
        }
      }
    }
  }

  const result: Record<string, string> = {};
  for (const entry of entries) {
    const currentLength = prefixLengths.get(entry.id) ?? entry.words.length;
    const sliceLength = Math.min(currentLength, entry.words.length);
    const label = entry.words.slice(0, sliceLength).join(' ') || entry.full;
    result[entry.id] = label;
  }

  return result;
}
