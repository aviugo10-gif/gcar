-- gcar · initial schema
-- Money is stored in agorot (integer). Columns ending in _enc are encrypted in the browser (AES-GCM, fixed-length padding)
-- with a key the server never sees. Every table has RLS; the public site reads only public_catalog and writes only through
-- the security-definer functions at the bottom.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------- enums ----------
create type vehicle_status as enum ('prep', 'available', 'reserved', 'sold');
create type fuel_type as enum ('petrol', 'diesel', 'hybrid', 'plugin', 'electric', 'gas');
create type gearbox_type as enum ('auto', 'manual', 'robotic', 'cvt');
create type accident_level as enum ('none', 'minor', 'structural', 'other');
create type ownership_flag as enum ('rental', 'leasing', 'company', 'taxi', 'driving_school', 'government', 'private_import', 'other');
create type deal_status as enum ('open', 'closed', 'cancelled');
create type payment_kind as enum ('deposit', 'payment');
create type payment_method as enum ('cash', 'transfer', 'check', 'card', 'financing', 'trade_in');
create type deal_doc_type as enum ('receipt', 'car_book', 'inspection', 'ownership_transfer', 'agreement', 'disclosure', 'other');
create type lead_kind as enum ('vehicle', 'general', 'notify_me');
create type lead_status as enum ('new', 'in_progress', 'meeting', 'won', 'lost');
create type scrap_status as enum ('new', 'quoted', 'accepted', 'collected', 'closed', 'rejected');
create type ocr_status as enum ('pending', 'done', 'failed');

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Staff = people allowed into the admin app. Today: the owner only. Later: an employee row with vault_access = false.
create table staff (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  vault_access boolean not null default true,
  created_at timestamptz not null default now()
);
alter table staff enable row level security;

-- Signed in, a staff member, and past the second factor (TOTP).
create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
revoke all on function is_staff() from public;
grant execute on function is_staff() to authenticated;

create policy staff_self on staff for select to authenticated using (user_id = auth.uid());

-- ---------- customers (before vehicles: reserved_for) ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  phone_alt text,
  id_number_enc text,            -- server-side AES-GCM (key in env, not in the DB)
  id_number_last4 text,          -- shown masked: •••••6789
  id_number_hmac text,           -- search only
  email text,
  address text,
  notes text,
  source_lead_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index customers_phone_uq on customers (phone) where deleted_at is null;
create index customers_name_trgm on customers using gin (full_name gin_trgm_ops);

-- ---------- vehicles ----------
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  vin text,
  make text not null,
  model text not null,
  trim text,
  year int check (year between 1950 and 2100),
  color text,
  fuel fuel_type,
  gearbox gearbox_type,
  engine_cc int,
  km int check (km >= 0),
  hand int check (hand between 0 and 30),
  test_valid_until date,
  accident accident_level not null default 'none',
  accident_notes text,
  notes text,
  status vehicle_status not null default 'prep',
  reserved_for uuid references customers,
  reserved_until date,
  stock_in_date date not null default current_date,
  listed_price int check (listed_price >= 0),      -- agorot, public
  purchase_price_enc text,                         -- vault-encrypted, fixed length
  min_price_enc text,                              -- vault-encrypted (would reveal purchase price)
  gov_data jsonb,
  gov_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint reserved_needs_customer check (status <> 'reserved' or reserved_for is not null)
);
create unique index vehicles_plate_uq on vehicles (plate) where deleted_at is null;
create index vehicles_status on vehicles (status) where deleted_at is null;
create index vehicles_search_trgm on vehicles using gin ((make || ' ' || model) gin_trgm_ops);

create table vehicle_ownership_flags (
  vehicle_id uuid not null references vehicles on delete cascade,
  flag ownership_flag not null,
  note text,
  primary key (vehicle_id, flag)
);

create table vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles on delete cascade,
  path text not null,             -- storage path in bucket vehicle-photos
  sort int not null default 0,
  is_main boolean not null default false,
  show_on_site boolean not null default true,
  w int, h int,
  created_at timestamptz not null default now()
);
create unique index vehicle_photos_one_main on vehicle_photos (vehicle_id) where is_main;

create table equipment_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'check',
  sort int not null default 0
);
create table vehicle_equipment (
  vehicle_id uuid not null references vehicles on delete cascade,
  item_id uuid not null references equipment_items on delete cascade,
  primary key (vehicle_id, item_id)
);

create table ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles on delete set null,
  doc_type text not null,          -- vehicle_license | receipt | id_card | check | deal_doc
  image_path text,
  provider text not null,
  raw jsonb,
  fields jsonb,
  confidence jsonb,
  status ocr_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------- vehicle expenses ----------
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null,
  sort int not null default 0,
  is_system boolean not null default false,
  deleted_at timestamptz
);
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  category_id uuid references expense_categories
);
create table vehicle_expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles on delete cascade,
  category_id uuid not null references expense_categories,
  amount int not null check (amount >= 0),          -- agorot
  date date not null default current_date,
  supplier_id uuid references suppliers,
  note text,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index vehicle_expenses_vehicle on vehicle_expenses (vehicle_id) where deleted_at is null;

-- ---------- deals ----------
create table deals (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles,
  customer_id uuid not null references customers,
  sale_price int not null check (sale_price >= 0),  -- agorot
  deal_date date not null default current_date,
  trade_in_vehicle_id uuid references vehicles,
  trade_in_value int check (trade_in_value >= 0),
  status deal_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index deals_one_active_per_vehicle on deals (vehicle_id) where status <> 'cancelled' and deleted_at is null;

create table deal_payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals on delete cascade,
  kind payment_kind not null default 'payment',
  amount int not null check (amount > 0),
  method payment_method not null,
  due_date date not null default current_date,
  paid_at date,                                     -- null = planned (e.g. post-dated check)
  check_number text,
  note text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals on delete cascade,
  type deal_doc_type not null,
  path text not null,                               -- private bucket deal-docs
  signed_at timestamptz,
  ocr_job_id uuid references ocr_jobs,
  created_at timestamptz not null default now()
);

create view deal_balance with (security_invoker = true) as
select d.id as deal_id,
       d.sale_price,
       coalesce(sum(p.amount) filter (where p.paid_at is not null and p.deleted_at is null), 0)::int as paid,
       (d.sale_price - coalesce(sum(p.amount) filter (where p.paid_at is not null and p.deleted_at is null), 0))::int as outstanding,
       count(*) filter (where p.paid_at is null and p.due_date < current_date and p.deleted_at is null)::int as overdue_count,
       min(p.due_date) filter (where p.paid_at is null and p.deleted_at is null) as next_due
from deals d
left join deal_payments p on p.deal_id = d.id
where d.deleted_at is null
group by d.id;

-- ---------- finance (fully encrypted payloads) ----------
create table business_expenses (
  id uuid primary key default gen_random_uuid(),
  month date not null,               -- first day of month; the only plaintext, for period filters
  payload_enc text not null,         -- {category, amount, vat, note, receipt_path}
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  payload_enc text not null,         -- {category, amount, day_of_month, note}
  active boolean not null default true,
  last_posted_month date,
  created_at timestamptz not null default now()
);
create table other_income (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  payload_enc text not null,         -- {category, amount, note}
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- site ----------
create table catalog_listings (
  vehicle_id uuid primary key references vehicles on delete cascade,
  is_published boolean not null default false,
  slug text not null unique,
  title_override text,
  marketing_text text,
  site_price int check (site_price >= 0),      -- agorot; null = vehicles.listed_price
  sale_price int check (sale_price >= 0),      -- discounted price; original shown struck through
  tags text[] not null default '{}',           -- new | sale | first_hand | final_price
  visible_fields text[] not null default '{year,km,hand,gearbox,engine_cc,fuel,test_valid_until,color}',
  pinned boolean not null default false,
  sort int not null default 0,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table banners (
  id uuid primary key default gen_random_uuid(),
  image_path text,
  title text not null,
  subtitle text,
  link text,
  starts_at timestamptz,
  ends_at timestamptz,
  sort int not null default 0,
  active boolean not null default true
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  kind lead_kind not null,
  vehicle_id uuid references vehicles on delete set null,
  name text not null check (length(name) between 2 and 80),
  phone text not null check (phone ~ '^0[2-9][0-9]{7,8}$'),
  message text check (length(message) <= 1000),
  privacy_accepted_at timestamptz not null,
  marketing_opt_in boolean not null default false,
  status lead_status not null default 'new',
  follow_up_at timestamptz,
  notes text,
  customer_id uuid references customers,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table scrap_requests (
  id uuid primary key default gen_random_uuid(),
  plate text,
  make text, model text, year int, km int,
  answers jsonb not null default '{}',
  photos text[] not null default '{}',             -- private bucket scrap-photos
  city text,
  lat double precision, lng double precision,
  name text not null check (length(name) between 2 and 80),
  phone text not null check (phone ~ '^0[2-9][0-9]{7,8}$'),
  contact_pref text not null default 'whatsapp' check (contact_pref in ('call', 'whatsapp')),
  privacy_accepted_at timestamptz not null,
  promised_by timestamptz,                         -- the promise shown to the customer
  status scrap_status not null default 'new',
  quote_amount int check (quote_amount >= 0),
  quoted_at timestamptz,
  quote_valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- system ----------
create table vault (
  id int primary key default 1 check (id = 1),     -- one vault per business
  wrapped_dek text not null,                       -- DEK wrapped by the Argon2id(password) key
  kdf_salt text not null,
  kdf_params jsonb not null,
  recovery_wrapped_dek text not null,              -- DEK wrapped by the printed recovery code
  prf_wrapped_dek text,                            -- optional: wrapped by a WebAuthn PRF output (Face ID)
  check_value text not null,                       -- encrypt("gcar-vault-ok") to verify the password
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,            -- login | vault_unlock | export | delete | ...
  entity text,
  entity_id uuid,
  ip_hash text,
  ua text
);

create table holidays (date date primary key, name text not null);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);

-- ---------- triggers ----------
do $$ declare t text; begin
  foreach t in array array['customers','vehicles','vehicle_expenses','deals','leads','scrap_requests','vault','catalog_listings','site_settings'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- A sold car leaves the catalog; "sold" only through a deal.
create or replace function vehicles_status_rules() returns trigger language plpgsql as $$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    if not exists (select 1 from deals where vehicle_id = new.id and status <> 'cancelled' and deleted_at is null) then
      raise exception 'vehicle can only be sold through a deal';
    end if;
    update catalog_listings set is_published = false where vehicle_id = new.id;
  end if;
  if new.status <> 'reserved' then new.reserved_for = null; new.reserved_until = null; end if;
  return new;
end $$;
create trigger vehicles_status_rules before update of status on vehicles for each row execute function vehicles_status_rules();

-- A deal marks its car sold.
create or replace function deals_mark_sold() returns trigger language plpgsql as $$
begin
  if new.status <> 'cancelled' then update vehicles set status = 'sold' where id = new.vehicle_id and status <> 'sold'; end if;
  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status <> 'cancelled' then
    update vehicles set status = 'available' where id = new.vehicle_id;
  end if;
  return new;
end $$;
create trigger deals_mark_sold after insert or update of status on deals for each row execute function deals_mark_sold();

-- ---------- RLS: staff can do everything; nobody else can read or write tables ----------
do $$ declare t text; begin
  foreach t in array array['customers','vehicles','vehicle_ownership_flags','vehicle_photos','equipment_items','vehicle_equipment','ocr_jobs',
    'expense_categories','suppliers','vehicle_expenses','deals','deal_payments','deal_documents','catalog_listings','site_settings','banners',
    'leads','scrap_requests','push_subscriptions','audit_log','holidays','rate_limits'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy staff_all on %I for all to authenticated using (is_staff()) with check (is_staff())', t);
  end loop;
end $$;

-- Finance and vault: staff with vault access only.
create or replace function has_vault_access() returns boolean language sql stable security definer set search_path = public as $$
  select is_staff() and exists (select 1 from staff where user_id = auth.uid() and vault_access)
$$;
grant execute on function has_vault_access() to authenticated;
do $$ declare t text; begin
  foreach t in array array['business_expenses','recurring_expenses','other_income','vault'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy vault_all on %I for all to authenticated using (has_vault_access()) with check (has_vault_access())', t);
  end loop;
end $$;
-- The audit log is append-only, even for staff.
drop policy staff_all on audit_log;
create policy audit_insert on audit_log for insert to authenticated with check (is_staff());
create policy audit_read on audit_log for select to authenticated using (is_staff());

-- ---------- public read model ----------
-- Only published, unsold cars; only what the owner chose to show, plus the mandatory ownership disclosure.
create view public_catalog with (security_invoker = false) as
select
  c.slug,
  v.id as vehicle_id,
  coalesce(c.title_override, v.make || ' ' || v.model) as title,
  v.make, v.model, v.trim,
  case when 'year' = any(c.visible_fields) then v.year end as year,
  case when 'km' = any(c.visible_fields) then v.km end as km,
  case when 'hand' = any(c.visible_fields) then v.hand end as hand,
  case when 'gearbox' = any(c.visible_fields) then v.gearbox end as gearbox,
  case when 'engine_cc' = any(c.visible_fields) then v.engine_cc end as engine_cc,
  case when 'fuel' = any(c.visible_fields) then v.fuel end as fuel,
  case when 'test_valid_until' = any(c.visible_fields) then v.test_valid_until end as test_valid_until,
  case when 'color' = any(c.visible_fields) then v.color end as color,
  v.status = 'reserved' as is_reserved,
  coalesce(c.site_price, v.listed_price) as price,
  c.sale_price,
  c.tags
    || case when v.hand = 1 and not ('first_hand' = any(c.tags)) then array['first_hand'] else '{}' end
    || case when c.published_at > now() - interval '14 days' and not ('new' = any(c.tags)) then array['new'] else '{}' end as tags,
  c.marketing_text,
  c.pinned, c.sort, c.published_at,
  (select coalesce(array_agg(f.flag::text), '{}') from vehicle_ownership_flags f where f.vehicle_id = v.id) as ownership_flags,
  (select coalesce(array_agg(e.name order by e.sort), '{}') from vehicle_equipment ve join equipment_items e on e.id = ve.item_id where ve.vehicle_id = v.id) as equipment,
  (select coalesce(json_agg(json_build_object('path', p.path, 'w', p.w, 'h', p.h) order by p.is_main desc, p.sort), '[]')
     from vehicle_photos p where p.vehicle_id = v.id and p.show_on_site) as photos
from catalog_listings c
join vehicles v on v.id = c.vehicle_id
where c.is_published and v.status in ('available', 'reserved') and v.deleted_at is null;

grant select on public_catalog to anon, authenticated;

create view public_settings with (security_invoker = false) as
select key, value from site_settings where key in ('business', 'hours', 'home', 'legal', 'scrap', 'contact');
grant select on public_settings to anon, authenticated;

create view public_holidays with (security_invoker = false) as select date, name from holidays where date >= current_date - 7;
grant select on public_holidays to anon, authenticated;

-- ---------- public writes: rate-limited functions ----------
create or replace function hit_rate_limit(p_key text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01'); n int;
begin
  insert into rate_limits (key, window_start) values (p_key, w)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into n;
  delete from rate_limits where window_start < now() - interval '1 day';
  return n <= p_max;
end $$;
revoke all on function hit_rate_limit(text, int, interval) from public;

create or replace function submit_lead(p_kind lead_kind, p_vehicle_slug text, p_name text, p_phone text, p_message text,
                                       p_privacy boolean, p_marketing boolean, p_client_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid; id uuid;
begin
  if not p_privacy then raise exception 'privacy consent required'; end if;
  if not hit_rate_limit('lead:' || coalesce(p_client_key, 'anon'), 5, interval '10 minutes') then raise exception 'rate limited'; end if;
  if p_vehicle_slug is not null then select vehicle_id into v from catalog_listings where slug = p_vehicle_slug; end if;
  insert into leads (kind, vehicle_id, name, phone, message, privacy_accepted_at, marketing_opt_in)
  values (p_kind, v, trim(p_name), regexp_replace(p_phone, '\D', '', 'g'), nullif(trim(p_message), ''), now(), coalesce(p_marketing, false))
  returning leads.id into id;
  return id;
end $$;
revoke all on function submit_lead from public;

create or replace function submit_scrap_request(p jsonb, p_client_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  if not coalesce((p ->> 'privacy')::boolean, false) then raise exception 'privacy consent required'; end if;
  if not hit_rate_limit('scrap:' || coalesce(p_client_key, 'anon'), 3, interval '10 minutes') then raise exception 'rate limited'; end if;
  insert into scrap_requests (plate, make, model, year, km, answers, photos, city, lat, lng, name, phone, contact_pref, privacy_accepted_at, promised_by)
  values (p ->> 'plate', p ->> 'make', p ->> 'model', (p ->> 'year')::int, (p ->> 'km')::int, coalesce(p -> 'answers', '{}'),
          coalesce(array(select jsonb_array_elements_text(p -> 'photos')), '{}'),
          p ->> 'city', (p ->> 'lat')::float8, (p ->> 'lng')::float8, trim(p ->> 'name'),
          regexp_replace(p ->> 'phone', '\D', '', 'g'), coalesce(p ->> 'contact_pref', 'whatsapp'), now(),
          (p ->> 'promised_by')::timestamptz)
  returning scrap_requests.id into id;
  return id;
end $$;
revoke all on function submit_scrap_request from public;
-- Both are called by the Next.js API routes with the service role, after validation and spam checks.

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values
  ('vehicle-photos', 'vehicle-photos', true),      -- only photos of published cars are linked from the site
  ('deal-docs', 'deal-docs', false),
  ('receipts', 'receipts', false),
  ('scrap-photos', 'scrap-photos', false),
  ('ocr', 'ocr', false)
on conflict do nothing;

create policy staff_storage_all on storage.objects for all to authenticated
  using (bucket_id in ('vehicle-photos', 'deal-docs', 'receipts', 'scrap-photos', 'ocr') and is_staff())
  with check (bucket_id in ('vehicle-photos', 'deal-docs', 'receipts', 'scrap-photos', 'ocr') and is_staff());

-- ---------- seed ----------
insert into expense_categories (name, icon, sort, is_system) values
  ('מכונאות', 'wrench', 1, true), ('פחחות וצבע', 'brush', 2, true), ('גיר', 'cog', 3, true), ('חשמל', 'zap', 4, true),
  ('צמיגים', 'disc', 5, true), ('ניקוי ופוליש', 'sparkles', 6, true), ('ריפוד', 'armchair', 7, true),
  ('טסט ורישוי', 'file-text', 8, true), ('גרירה', 'truck', 9, true), ('דלק', 'fuel', 10, true);

insert into equipment_items (name, sort) values
  ('מצלמת רוורס', 1), ('חיישני חניה', 2), ('מולטימדיה', 3), ('Apple CarPlay', 4), ('Android Auto', 5), ('בקרת שיוט', 6),
  ('בקרת שיוט אדפטיבית', 7), ('שמירת נתיב', 8), ('מערכת למניעת תאונות', 9), ('גג נפתח', 10), ('מושבי עור', 11),
  ('מושבים מחוממים', 12), ('חלונות חשמל', 13), ('מראות מתקפלות', 14), ('ג׳אנטים', 15), ('פנסי LED', 16), ('כניסה ללא מפתח', 17),
  ('מיזוג מפוצל', 18), ('וו גרירה', 19), ('7 מקומות', 20);

insert into site_settings (key, value) values
  ('business', '{"name":"gcar","tagline":"קנייה | מכירה | שירותי רכב","phone":"0528528282","whatsapp":"972528528282","email":null,"address":null,"lat":null,"lng":null,"vat_rate":18}'),
  ('hours', '{"sun":["09:00","19:00"],"mon":["09:00","19:00"],"tue":["09:00","19:00"],"wed":["09:00","19:00"],"thu":["09:00","19:00"],"fri":["09:00","13:00"],"sat":null}'),
  ('home', '{"headline":"רכב טוב, מחיר הוגן, בלי הפתעות","sub":"כל רכב במגרש נבדק ומגיע עם היסטוריה מלאה. בואו לראות, לנסוע ולהחליט בשקט."}'),
  ('scrap', '{"promise_enabled":true,"promise_minutes":30}'),
  ('legal', '{"accessibility_coordinator":{"name":null,"phone":null,"email":null},"last_audit":null}'),
  ('contact', '{"waze":null,"maps":null}');
