-- Stage 4 hardening. Safe to run after 0001.
set client_min_messages = warning;

-- ---------- 1. functions: Supabase grants EXECUTE to anon/authenticated by default, so revoke explicitly ----------
-- The public forms call these only through the Next.js API routes (service role), after origin, honeypot and timing checks.
revoke execute on function submit_lead from public, anon, authenticated;
revoke execute on function submit_scrap_request from public, anon, authenticated;
revoke execute on function hit_rate_limit(text, int, interval) from public, anon, authenticated;
grant execute on function submit_lead to service_role;
grant execute on function submit_scrap_request to service_role;
grant execute on function hit_rate_limit(text, int, interval) to service_role;
revoke execute on function has_vault_access() from public, anon;
revoke execute on function is_staff() from anon;

-- ---------- 2. anon: nothing but the three public views (RLS already blocks rows; this removes the grants too) ----------
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on table %I from anon', t);
  end loop;
end $$;
revoke all on public_catalog, public_settings, public_holidays, deal_balance from anon;
grant select on public_catalog, public_settings, public_holidays to anon;

-- ---------- 3. storage: size and type limits on every bucket (signed upload URLs can't be used for anything else) ----------
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/webp'] where id in ('vehicle-photos', 'scrap-photos');
update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg', 'application/pdf'] where id in ('deal-docs', 'receipts', 'ocr');

-- ---------- 4. audit trail: who changed what, when. Column names only, never values (prices stay private) ----------
alter table audit_log add column if not exists fields text[];
create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(n.key order by n.key) into changed
    from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at');
    if changed is null then return new; end if;
  end if;
  insert into audit_log (actor, action, entity, entity_id, fields)
  values (auth.uid(), lower(tg_op), tg_table_name,
          (coalesce(to_jsonb(new), to_jsonb(old)) ->> case when tg_table_name = 'staff' then 'user_id' else 'id' end)::uuid, changed);
  return coalesce(new, old);
end $$;
revoke execute on function audit_row() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['vehicles','customers','deals','deal_payments','deal_documents','catalog_listings','vehicle_expenses','business_expenses','other_income','staff'] loop
    execute format('drop trigger if exists %I_audit on %I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit_row()', t, t);
  end loop;
end $$;
-- vault: one row, id = 1 (not uuid), audited separately
create or replace function audit_vault() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor, action, entity) values (auth.uid(), 'vault_' || lower(tg_op), 'vault');
  return coalesce(new, old);
end $$;
revoke execute on function audit_vault() from public, anon, authenticated;
drop trigger if exists vault_audit on vault;
create trigger vault_audit after insert or update or delete on vault for each row execute function audit_vault();

-- ---------- 5. retention (Privacy Protection Regulations: keep personal data only as long as needed) ----------
-- Leads that didn't become a deal: 24 months. Closed or rejected scrap requests: 12 months. Rate-limit rows: 2 days.
create or replace function purge_personal_data() returns jsonb language plpgsql security definer set search_path = public as $$
declare a int; b int; c int;
begin
  delete from leads where created_at < now() - interval '24 months' and status <> 'won'; get diagnostics a = row_count;
  delete from scrap_requests where created_at < now() - interval '12 months' and status in ('closed', 'rejected'); get diagnostics b = row_count;
  delete from rate_limits where window_start < now() - interval '2 days'; get diagnostics c = row_count;
  insert into audit_log (action, entity) values ('purge', format('leads=%s scrap=%s rate=%s', a, b, c));
  return jsonb_build_object('leads', a, 'scrap', b, 'rate_limits', c);
end $$;
revoke execute on function purge_personal_data() from public, anon, authenticated;
grant execute on function purge_personal_data() to service_role;
-- Daily at 03:15 when pg_cron is enabled (Supabase: Database → Extensions → pg_cron).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gcar-purge', '15 3 * * *', 'select purge_personal_data()');
  end if;
end $$;
