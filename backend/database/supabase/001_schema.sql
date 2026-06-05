-- Supabase/PostgreSQL schema for the Smart-Niche Marketplace backend.
-- Run this file in Supabase Dashboard > SQL Editor before starting the API.

create table if not exists public.users (
  user_id text primary key,
  username text not null,
  email text not null unique,
  password_hash text not null,
  is_logged_in boolean not null default false,
  token text,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  product_id text primary key,
  name text not null,
  category text not null,
  image text,
  description text,
  price numeric not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  order_id text primary key,
  user_id text references public.users(user_id) on delete set null,
  is_guest_checkout boolean not null default true,
  guest_name text,
  guest_email text,
  address text not null,
  subtotal_amount numeric not null default 0 check (subtotal_amount >= 0),
  subscription_discount_amount numeric not null default 0 check (subscription_discount_amount >= 0),
  dynamic_discount_amount numeric not null default 0 check (dynamic_discount_amount >= 0),
  dynamic_discount_reason text,
  total_amount numeric not null check (total_amount >= 0),
  order_status text not null default 'pending'
    check (order_status in ('pending', 'placed', 'completed', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_guest_checkout = false and user_id is not null)
    or
    (is_guest_checkout = true and guest_name is not null and guest_email is not null)
  )
);

create table if not exists public.order_items (
  order_item_id text primary key,
  order_id text not null references public.orders(order_id) on delete cascade,
  product_id text not null references public.products(product_id) on delete restrict,
  quantity integer not null check (quantity > 0),
  is_recurring boolean not null default false,
  frequency text check (frequency in ('weekly', 'bi_weekly', 'monthly')),
  next_delivery_date timestamptz,
  unit_price numeric not null check (unit_price >= 0),
  discount_applied numeric not null default 0 check (discount_applied >= 0),
  line_total numeric not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  check (
    (is_recurring = false and frequency is null and next_delivery_date is null)
    or
    (is_recurring = true and frequency is not null)
  )
);

create table if not exists public.payments (
  payment_id text primary key,
  order_id text not null references public.orders(order_id) on delete cascade,
  payment_method text not null default 'bypassed'
    check (payment_method in ('bypassed', 'bank_transfer', 'credit_card', 'cod')),
  payment_status text not null default 'bypassed'
    check (payment_status in ('bypassed', 'pending', 'completed', 'failed')),
  transaction_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.carts (
  cart_id text primary key,
  user_id text references public.users(user_id) on delete cascade,
  session_id text,
  status text not null default 'active'
    check (status in ('active', 'checked_out', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or session_id is not null)
);

create table if not exists public.cart_items (
  cart_item_id text primary key,
  cart_id text not null references public.carts(cart_id) on delete cascade,
  product_id text not null references public.products(product_id) on delete restrict,
  quantity integer not null check (quantity > 0),
  is_recurring boolean not null default false,
  frequency text check (frequency in ('weekly', 'bi_weekly', 'monthly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id),
  check (
    (is_recurring = false and frequency is null)
    or
    (is_recurring = true and frequency is not null)
  )
);

create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_price on public.products(price);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_cart_items_cart_id on public.cart_items(cart_id);
create index if not exists idx_cart_items_product_id on public.cart_items(product_id);

create unique index if not exists idx_active_carts_user_id
  on public.carts(user_id)
  where user_id is not null and status = 'active';

create unique index if not exists idx_active_carts_session_id
  on public.carts(session_id)
  where session_id is not null and status = 'active';

create or replace function public.get_product_recommendations(
  p_product_id text,
  p_limit integer default 5
)
returns table (
  product_id text,
  name text,
  category text,
  image text,
  description text,
  price numeric,
  stock_quantity integer,
  co_purchase_count bigint,
  user_count bigint
)
language sql
stable
as $$
  select
    recommended.product_id,
    recommended.name,
    recommended.category,
    recommended.image,
    recommended.description,
    recommended.price,
    recommended.stock_quantity,
    count(*) as co_purchase_count,
    count(distinct target_orders.user_id) as user_count
  from public.order_items target_items
  join public.orders target_orders
    on target_orders.order_id = target_items.order_id
  join public.order_items recommended_items
    on recommended_items.order_id = target_items.order_id
    and recommended_items.product_id <> target_items.product_id
  join public.products recommended
    on recommended.product_id = recommended_items.product_id
  where target_items.product_id = p_product_id
    and target_orders.user_id is not null
  group by
    recommended.product_id,
    recommended.name,
    recommended.category,
    recommended.image,
    recommended.description,
    recommended.price,
    recommended.stock_quantity
  order by co_purchase_count desc, recommended.product_id
  limit greatest(p_limit, 1);
$$;

create or replace function public.commit_checkout_order(
  p_order jsonb,
  p_items jsonb,
  p_payment_id text,
  p_cart_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  updated_product products%rowtype;
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CHECKOUT: checkout requires at least one item.';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    select *
    into updated_product
    from public.products
    where product_id = item->>'product_id'
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND: Product % was not found.', item->>'product_id';
    end if;

    if updated_product.stock_quantity < (item->>'quantity')::integer then
      raise exception 'OUT_OF_STOCK: % is out of stock.', updated_product.name;
    end if;

    update public.products
    set
      stock_quantity = stock_quantity - (item->>'quantity')::integer,
      updated_at = now()
    where product_id = item->>'product_id';
  end loop;

  insert into public.orders (
    order_id,
    user_id,
    is_guest_checkout,
    guest_name,
    guest_email,
    address,
    subtotal_amount,
    subscription_discount_amount,
    dynamic_discount_amount,
    dynamic_discount_reason,
    total_amount,
    order_status,
    updated_at
  )
  values (
    p_order->>'order_id',
    nullif(p_order->>'user_id', ''),
    coalesce((p_order->>'is_guest_checkout')::boolean, true),
    p_order->>'guest_name',
    p_order->>'guest_email',
    p_order->>'address',
    (p_order->>'subtotal_amount')::numeric,
    (p_order->>'subscription_discount_amount')::numeric,
    (p_order->>'dynamic_discount_amount')::numeric,
    p_order->>'dynamic_discount_reason',
    (p_order->>'total_amount')::numeric,
    'placed',
    now()
  );

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (
      order_item_id,
      order_id,
      product_id,
      quantity,
      is_recurring,
      frequency,
      next_delivery_date,
      unit_price,
      discount_applied,
      line_total
    )
    values (
      item->>'order_item_id',
      p_order->>'order_id',
      item->>'product_id',
      (item->>'quantity')::integer,
      coalesce((item->>'is_recurring')::boolean, false),
      item->>'frequency',
      nullif(item->>'next_delivery_date', '')::timestamptz,
      (item->>'unit_price')::numeric,
      (item->>'discount_applied')::numeric,
      (item->>'line_total')::numeric
    );
  end loop;

  insert into public.payments (
    payment_id,
    order_id,
    payment_method,
    payment_status,
    transaction_ref
  )
  values (
    p_payment_id,
    p_order->>'order_id',
    coalesce(p_order->>'payment_method', 'bypassed'),
    coalesce(p_order->>'payment_status', 'bypassed'),
    p_order->>'transaction_ref'
  );

  if p_cart_id is not null then
    update public.carts
    set status = 'checked_out', updated_at = now()
    where cart_id = p_cart_id;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on function public.get_product_recommendations(text, integer) to anon, authenticated;
grant execute on function public.commit_checkout_order(jsonb, jsonb, text, text) to anon, authenticated;

