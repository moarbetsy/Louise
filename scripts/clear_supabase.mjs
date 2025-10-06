#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env = { VITE_SUPABASE_URL: undefined, VITE_SUPABASE_ANON_KEY: undefined };
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (val?.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key in env) env[key] = val;
    }
  } catch (e) {
    console.error('Could not read .env.local', e);
  }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) in .env.local');
  }
  return env;
}

async function tableExists(supabase, table) {
  try {
    const { error } = await supabase.from(table).select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function deleteAll(supabase, table) {
  // Use IS NOT NULL filter to target all rows regardless of id type
  const { error, count } = await supabase.from(table).delete({ count: 'exact' }).not('id', 'is', null);
  if (error) {
    console.warn(`Failed to clear ${table}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const cleared = {};
  // Attempt to clear both normalized and flat tables; ignore missing tables
  // Normalized relations first
  cleared.order_items = await deleteAll(supabase, 'order_items');
  cleared.orders = await deleteAll(supabase, 'orders');
  cleared.product_tiers = await deleteAll(supabase, 'product_tiers');
  cleared.products = await deleteAll(supabase, 'products');
  // Flat-only also share names above; continue with independent tables
  cleared.expenses = await deleteAll(supabase, 'expenses');
  cleared.logs = await deleteAll(supabase, 'logs');
  cleared.clients = await deleteAll(supabase, 'clients');

  console.log('Cleared tables:', cleared);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
