-- Normalized schema for long-term growth and analytics.

-- Enable UUID generation
create extension if not exists pgcrypto;

create type unit_type as enum ('g','ml','unit');
create type order_status as enum ('Draft','Unpaid','Completed');
create type move_type as enum ('ORDER_CONSUME','RETURN_STOCK','MANUAL_ADJUST','PURCHASE');

create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  display_id    int generated always as identity unique,
  name          text not null,
  email         text, 
  phone         text, 
  address       text, 
  etransfer     text, 
  notes         text,
  inactive      boolean default false,
  created_at    timestamptz default now(), 
  updated_at    timestamptz default now()
);

create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  display_id    int generated always as identity unique,
  name          text not null,
  type          unit_type not null,
  stock         numeric(14,4) default 0,
  cost_per_unit numeric(14,6) default 0,
  increment     numeric(12,4) default 1,
  inactive      boolean default false,
  last_ordered  timestamptz,
  created_at    timestamptz default now(), 
  updated_at    timestamptz default now()
);

create table if not exists product_tiers (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  size_label    text not null,
  quantity      numeric(12,4) not null,
  price         numeric(12,2) not null
);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  display_id      int generated always as identity unique,
  client_id       uuid not null references clients(id) on delete restrict,
  date            date not null,
  amount_paid     numeric(12,2) default 0,
  total           numeric(12,2) not null,
  status          order_status not null,
  fees_json       jsonb,
  discount_json   jsonb,
  payment_methods jsonb,
  notes           text,
  created_at      timestamptz default now(), 
  updated_at      timestamptz default now()
);

create table if not exists order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  product_id  uuid not null references products(id) on delete restrict,
  size_label  text,
  quantity    numeric(12,4) not null,
  unit_price  numeric(12,2) not null,
  line_price  numeric(12,2) not null
);

create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  display_id    int generated always as identity unique,
  date          date not null,
  description   text not null,
  amount        numeric(12,2) not null,
  category      text, 
  notes         text,
  created_at    timestamptz default now(), 
  updated_at    timestamptz default now()
);

create table if not exists logs (
  id         uuid primary key default gen_random_uuid(),
  timestamp  timestamptz not null,
  "user"     text not null,
  action     text not null,
  details    jsonb,
  created_at timestamptz default now()
);

create table if not exists inventory_movements (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid not null references products(id) on delete restrict,
  movement_type       move_type not null,
  qty_change          numeric(14,4) not null,
  purchase_cost_total numeric(14,2),
  note                text,
  created_at          timestamptz default now()
);

create index if not exists orders_date_idx on orders(date);
create index if not exists orders_client_idx on orders(client_id);
create index if not exists order_items_product_idx on order_items(product_id);
create index if not exists products_name_idx on products((lower(name)));

-- Triggers to manage stock/cost can be added later if desired.
