-- AMI Designs & Events: manual M-Pesa Till payments with admin approval
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor).
--
-- IMPORTANT: this file was written without access to your existing database
-- definitions. Before running, compare these against what you have:
--   1. tickets columns/constraints (status check, code NOT NULL, etc.)
--   2. scan_ticket (section 5 replaces it; its output columns must match what
--      js/admin-tickets.js reads: result, ticket_code, buyer_name,
--      buyer_whatsapp, ticket_type_name, event_title, used_at)
--   3. Your existing ticket code format (section 2, generate_ticket_code)
--   4. Who counts as admin (section 1, is_admin_user)

-- ---------------------------------------------------------------
-- 1. Admin check. Currently: any signed-in Supabase Auth user.
--    Tighten this if you ever add non-admin accounts.
-- ---------------------------------------------------------------
create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;

-- ---------------------------------------------------------------
-- 2. Table changes
-- ---------------------------------------------------------------
alter table public.tickets add column if not exists mpesa_code text;
alter table public.tickets add column if not exists payment_method text;
alter table public.tickets add column if not exists note text;
alter table public.tickets add column if not exists approved_at timestamptz;

-- One M-Pesa confirmation code can only ever back one ticket.
create unique index if not exists tickets_mpesa_code_unique
  on public.tickets (upper(mpesa_code))
  where mpesa_code is not null;

-- Allow pending / rejected in addition to valid / used.
alter table public.tickets drop constraint if exists tickets_status_check;
alter table public.tickets
  add constraint tickets_status_check
  check (status in ('pending', 'valid', 'used', 'rejected'));

-- Ticket code generator (AMI-XXXXXX, no confusing 0/O/1/I characters).
-- Replace the body if your existing tickets use a different format.
create or replace function public.generate_ticket_code()
returns text
language plpgsql
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := 'AMI-';
    for i in 1..6 loop
      candidate := candidate || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.tickets where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------
-- 3. Buyer-facing RPCs (callable by anon)
-- ---------------------------------------------------------------

-- Creates a PENDING ticket. Not valid at the door until an admin approves it.
create or replace function public.submit_manual_ticket_order(
  p_ticket_type_id uuid,
  p_buyer_name text,
  p_buyer_whatsapp text,
  p_mpesa_code text
)
returns table (ticket_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  tt record;
  v_code text := upper(trim(p_mpesa_code));
  v_id uuid;
begin
  if v_code !~ '^[A-Z0-9]{10}$' then
    raise exception 'Enter the 10-character M-Pesa confirmation code from your payment message.';
  end if;

  if coalesce(trim(p_buyer_name), '') = '' then
    raise exception 'Please enter your name.';
  end if;

  if regexp_replace(coalesce(p_buyer_whatsapp, ''), '[^0-9]', '', 'g') !~ '^254[0-9]{9}$' then
    raise exception 'Enter your WhatsApp number as 2547XXXXXXXX.';
  end if;

  select * into tt from public.ticket_types where id = p_ticket_type_id;
  if not found then
    raise exception 'This ticket is no longer available.';
  end if;
  if tt.expires_at is not null and tt.expires_at < now() then
    raise exception 'This offer has closed.';
  end if;
  if tt.quantity_sold >= tt.quantity_limit then
    raise exception 'This ticket is sold out.';
  end if;

  if exists (select 1 from public.tickets where upper(mpesa_code) = v_code) then
    raise exception 'That M-Pesa code has already been submitted.';
  end if;

  insert into public.tickets
    (code, brand_id, ticket_type_id, buyer_name, buyer_whatsapp, price_paid,
     status, mpesa_code, payment_method)
  values
    (public.generate_ticket_code(), tt.brand_id, tt.id, trim(p_buyer_name),
     regexp_replace(p_buyer_whatsapp, '[^0-9]', '', 'g'), tt.price,
     'pending', v_code, 'mpesa_till')
  returning id into v_id;

  return query select v_id, 'pending'::text;
end;
$$;

-- Buyer checks their ticket using the phone number and M-Pesa code they gave.
create or replace function public.lookup_manual_ticket(
  p_whatsapp text,
  p_mpesa_code text
)
returns table (
  status text,
  ticket_code text,
  brand_name text,
  event_title text,
  ticket_type_name text,
  people_count int,
  price_paid numeric,
  event_date timestamptz,
  event_location text
)
language sql
security definer
set search_path = public
as $$
  select
    t.status,
    case when t.status in ('valid', 'used') then t.code end,
    b.name,
    b.event_title,
    tt.name,
    tt.people_count,
    t.price_paid,
    b.event_date,
    b.event_location
  from public.tickets t
  join public.brands b on b.id = t.brand_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  where upper(t.mpesa_code) = upper(trim(p_mpesa_code))
    and t.buyer_whatsapp = regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g')
  limit 1;
$$;

grant execute on function public.submit_manual_ticket_order(uuid, text, text, text) to anon, authenticated;
grant execute on function public.lookup_manual_ticket(text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 4. Admin RPCs
-- ---------------------------------------------------------------
create or replace function public.approve_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  tt record;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorised.';
  end if;

  select * into t from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'Ticket not found.'; end if;
  if t.status <> 'pending' then raise exception 'Only pending tickets can be approved.'; end if;

  select * into tt from public.ticket_types where id = t.ticket_type_id for update;
  if not found then raise exception 'Ticket type no longer exists.'; end if;
  if tt.quantity_sold >= tt.quantity_limit then
    raise exception 'Sold out. Reject this order and refund the buyer.';
  end if;

  update public.tickets set status = 'valid', approved_at = now() where id = p_ticket_id;
  update public.ticket_types set quantity_sold = quantity_sold + 1 where id = tt.id;
end;
$$;

create or replace function public.reject_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorised.';
  end if;
  update public.tickets set status = 'rejected'
  where id = p_ticket_id and status = 'pending';
end;
$$;

-- Cash / WhatsApp / in-person sale: creates a VALID ticket immediately.
create or replace function public.admin_issue_ticket(
  p_ticket_type_id uuid,
  p_buyer_name text,
  p_buyer_whatsapp text,
  p_method text,
  p_note text
)
returns table (
  ticket_code text,
  brand_name text,
  event_title text,
  ticket_type_name text,
  people_count int,
  price_paid numeric,
  event_date timestamptz,
  event_location text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  tt record;
  v_code text;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorised.';
  end if;

  select * into tt from public.ticket_types where id = p_ticket_type_id for update;
  if not found then raise exception 'Ticket type not found.'; end if;
  if tt.quantity_sold >= tt.quantity_limit then raise exception 'Sold out.'; end if;

  v_code := public.generate_ticket_code();

  insert into public.tickets
    (code, brand_id, ticket_type_id, buyer_name, buyer_whatsapp, price_paid,
     status, payment_method, note, approved_at)
  values
    (v_code, tt.brand_id, tt.id, trim(p_buyer_name),
     regexp_replace(coalesce(p_buyer_whatsapp, ''), '[^0-9]', '', 'g'), tt.price,
     'valid', coalesce(nullif(trim(p_method), ''), 'cash'), nullif(trim(p_note), ''), now());

  update public.ticket_types set quantity_sold = quantity_sold + 1 where id = tt.id;

  return query
    select v_code, b.name, b.event_title, tt.name, tt.people_count, tt.price,
           b.event_date, b.event_location
    from public.brands b where b.id = tt.brand_id;
end;
$$;

revoke execute on function public.approve_ticket(uuid) from public, anon;
revoke execute on function public.reject_ticket(uuid) from public, anon;
revoke execute on function public.admin_issue_ticket(uuid, text, text, text, text) from public, anon;
grant execute on function public.approve_ticket(uuid) to authenticated;
grant execute on function public.reject_ticket(uuid) to authenticated;
grant execute on function public.admin_issue_ticket(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------
-- 5. Scanner: only VALID tickets may check in. Pending and rejected tickets
--    are reported as not_found. This REPLACES your existing scan_ticket.
-- ---------------------------------------------------------------
drop function if exists public.scan_ticket(text);

create or replace function public.scan_ticket(p_code text)
returns table (
  result text,
  ticket_code text,
  buyer_name text,
  buyer_whatsapp text,
  ticket_type_name text,
  event_title text,
  used_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorised.';
  end if;

  select tk.*, tt.name as tt_name, b.event_title as ev_title
    into t
  from public.tickets tk
  join public.ticket_types tt on tt.id = tk.ticket_type_id
  join public.brands b on b.id = tk.brand_id
  where tk.code = trim(p_code)
    and tk.status in ('valid', 'used')
  for update of tk;

  if not found then
    return query select 'not_found'::text, trim(p_code), null::text, null::text,
                        null::text, null::text, null::timestamptz;
    return;
  end if;

  if t.status = 'used' then
    return query select 'already_used'::text, t.code, t.buyer_name, t.buyer_whatsapp,
                        t.tt_name, t.ev_title, t.used_at;
    return;
  end if;

  update public.tickets set status = 'used', used_at = now() where id = t.id;

  return query select 'valid'::text, t.code, t.buyer_name, t.buyer_whatsapp,
                      t.tt_name, t.ev_title, now();
end;
$$;

grant execute on function public.scan_ticket(text) to authenticated;

-- ---------------------------------------------------------------
-- 6. Make sure anon can never read pending/rejected tickets directly.
--    Review your existing RLS policies on public.tickets: anon should have
--    NO select policy. Buyers use lookup_manual_ticket instead.
-- ---------------------------------------------------------------
alter table public.tickets enable row level security;
