-- Run after stub_supabase.sql + migrations. Fails loudly on the first broken rule.
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
insert into staff values ('00000000-0000-0000-0000-000000000001', 'owner', true, now());

-- seed as superuser
insert into vehicles (id, plate, make, model, year, km, hand, status, listed_price, purchase_price_enc)
values ('10000000-0000-0000-0000-000000000001', '12345678', 'מאזדה', '3', 2021, 58000, 1, 'available', 8490000, 'v1.ENCRYPTED'),
       ('10000000-0000-0000-0000-000000000002', '7654321', 'קיה', 'ספורטאז׳', 2018, 120000, 2, 'prep', 6200000, null);
insert into catalog_listings (vehicle_id, is_published, slug, published_at) values
  ('10000000-0000-0000-0000-000000000001', true, 'mazda-3-2021-a1', now()),
  ('10000000-0000-0000-0000-000000000002', true, 'kia-sportage-2018-b2', now());
insert into customers (id, full_name, phone) values ('20000000-0000-0000-0000-000000000001', 'ישראל ישראלי', '0501234567');

-- 1. anon: no tables, catalog view only, without internal fields
set role anon;
do $$ begin
  begin perform * from vehicles; raise exception 'FAIL anon read vehicles'; exception when insufficient_privilege then null; end;
end $$;
select case when count(*) = 1 then 'ok 1a: anon sees 1 published available car (prep hidden)' else 'FAIL 1a' end from public_catalog;
select case when 'first_hand' = any(tags) and 'new' = any(tags) then 'ok 1b: auto tags' else 'FAIL 1b' end from public_catalog;
do $$ begin
  begin perform purchase_price_enc from public_catalog; raise exception 'FAIL anon sees purchase price'; exception when undefined_column then null; end;
end $$;
select 'ok 1c: no purchase price column in public view';
reset role;

-- 2. authenticated staff WITHOUT second factor: sees nothing
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
select case when count(*) = 0 then 'ok 2: aal1 sees no vehicles' else 'FAIL 2' end from vehicles;

-- 3. non-staff user with aal2: sees nothing
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
select case when count(*) = 0 then 'ok 3: non-staff sees nothing' else 'FAIL 3' end from vehicles;

-- 4. staff with aal2: full access
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select case when count(*) = 2 then 'ok 4: staff aal2 sees vehicles' else 'FAIL 4' end from vehicles;

-- 5. cannot mark sold without a deal
do $$ begin
  begin update vehicles set status = 'sold' where plate = '12345678'; raise exception 'FAIL 5 sold without deal';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
select 'ok 5: sold requires a deal';

-- 6. a deal sells the car and unpublishes it
insert into deals (vehicle_id, customer_id, sale_price) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 8200000);
select case when status = 'sold' then 'ok 6a: deal marks sold' else 'FAIL 6a' end from vehicles where plate = '12345678';
select case when not is_published then 'ok 6b: sold car unpublished' else 'FAIL 6b' end from catalog_listings where slug = 'mazda-3-2021-a1';

-- 7. balance view
insert into deal_payments (deal_id, amount, method, paid_at) select id, 5000000, 'transfer', current_date from deals;
insert into deal_payments (deal_id, amount, method, due_date) select id, 1000000, 'check', current_date - 3 from deals;
select case when paid = 5000000 and outstanding = 3200000 and overdue_count = 1 then 'ok 7: deal balance' else 'FAIL 7 ' || paid || ' ' || outstanding end from deal_balance;

-- 8. audit log is append-only
insert into audit_log (actor, action) values (auth.uid(), 'test');
do $$ declare n int; begin
  delete from audit_log; get diagnostics n = row_count;
  if n > 0 then raise exception 'FAIL 8 audit deletable'; end if;
end $$;
select 'ok 8: audit log append-only';
reset role;

-- 9. public lead function validates consent and rate-limits
select case when submit_lead('general', null, 'דנה', '0521234567', 'שלום', true, false, 'ip1') is not null then 'ok 9a: lead saved' end;
do $$ begin
  begin perform submit_lead('general', null, 'דנה', '0521234567', null, false, false, 'ip2'); raise exception 'FAIL 9b';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
select 'ok 9b: consent required';
do $$ declare i int; begin
  for i in 1..4 loop perform submit_lead('general', null, 'דנה', '0521234567', null, true, false, 'ip1'); end loop;
  begin perform submit_lead('general', null, 'דנה', '0521234567', null, true, false, 'ip1'); raise exception 'FAIL 9c';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
select 'ok 9c: rate limited after 5';
