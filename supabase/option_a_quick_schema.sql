-- Quick schema that matches the current app payloads and property names.
-- Uses quoted camelCase columns to align with existing upsertRow(...) calls.

create table if not exists public.clients (
  "id"           text primary key,
  "displayId"    integer unique,
  "name"         text not null,
  "email"        text,
  "phone"        text,
  "address"      text,
  "etransfer"    text,
  "notes"        text,
  "inactive"     boolean default false,

  -- present in initial client payloads
  "orders"       integer default 0,
  "totalSpent"   numeric(12,2) default 0,

  "created_at"   timestamptz default now(),
  "updated_at"   timestamptz default now()
);

create table if not exists public.products (
  "id"           text primary key,
  "displayId"    integer unique,
  "name"         text not null,
  "type"         text check ("type" in ('g','ml','unit')) not null,
  "stock"        numeric(14,4) default 0,
  "costPerUnit"  numeric(14,6) default 0,
  "increment"    numeric(12,4) default 1,
  "tiers"        jsonb,
  "inactive"     boolean default false,
  "lastOrdered"  timestamptz,
  "sortIndex"    integer default 0,
  "created_at"   timestamptz default now(),
  "updated_at"   timestamptz default now()
);

create table if not exists public.orders (
  "id"             text primary key,
  "displayId"      integer unique,
  "clientId"       text not null references public.clients("id") on delete restrict,
  "date"           date not null,
  "items"          jsonb not null,    -- [{productId, quantity, price, sizeLabel?}]
  "fees"           jsonb,             -- {amount, description}
  "discount"       jsonb,             -- {amount, description}
  "amountPaid"     numeric(12,2) default 0,
  "total"          numeric(12,2) not null,
  "status"         text check ("status" in ('Draft','Unpaid','Completed')) not null,
  "paymentMethods" jsonb,             -- {cash:number, etransfer:number}
  "notes"          text,
  "created_at"     timestamptz default now(),
  "updated_at"     timestamptz default now()
);

create table if not exists public.expenses (
  "id"           text primary key,
  "displayId"    integer unique,
  "date"         date not null,
  "description"  text not null,
  "amount"       numeric(12,2) not null,
  "category"     text,
  "notes"        text,
  "sortIndex"    integer default 0,
  "created_at"   timestamptz default now(),
  "updated_at"   timestamptz default now()
);

create table if not exists public.logs (
  "id"         text primary key,
  "timestamp"  timestamptz not null,
  "user"       text not null,
  "action"     text not null,
  "details"    jsonb,
  "created_at" timestamptz default now()
);

-- Helpful indexes
create index if not exists orders_date_idx      on public.orders ("date");
create index if not exists orders_client_idx    on public.orders ("clientId");
create index if not exists products_name_idx    on public.products ((lower("name")));
