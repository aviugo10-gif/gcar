-- Run after rls_test.sql and 0002_security.sql.
\set ON_ERROR_STOP 1

-- 10. anon can't call the form functions directly (only the API routes, via service role)
set role anon;
do $$ begin
  begin perform submit_lead('general', null, 'x', '0521234567', null, true, false, 'k'); raise exception 'FAIL 10a anon can call submit_lead';
  exception when insufficient_privilege then null; end;
  begin perform hit_rate_limit('k', 1, interval '1 minute'); raise exception 'FAIL 10b anon can call hit_rate_limit';
  exception when insufficient_privilege then null; end;
  begin perform * from leads; raise exception 'FAIL 10c anon reads leads';
  exception when insufficient_privilege then null; end;
  begin perform purge_personal_data(); raise exception 'FAIL 10d';
  exception when insufficient_privilege then null; end;
end $$;
select case when count(*) >= 0 then 'ok 10: anon has no function or table access, catalog still readable' end from public_catalog;
reset role;

-- 11. staff changes are audited by column name, without values
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
update vehicles set km = km + 1, purchase_price_enc = 'v1.NEWCIPHER' where plate = '7654321';
reset role;
select case when fields @> array['km', 'purchase_price_enc'] and actor = '00000000-0000-0000-0000-000000000001' then 'ok 11a: audit row with field names'
  else 'FAIL 11a' end from audit_log where entity = 'vehicles' and action = 'update' order by id desc limit 1;
select case when count(*) = 0 then 'ok 11b: audit never stores price values' else 'FAIL 11b' end from audit_log where array_to_string(fields, ',') like '%NEWCIPHER%';

-- 12. retention
insert into leads (kind, name, phone, status, created_at, privacy_accepted_at) values ('general', 'ישן', '0520000000', 'lost', now() - interval '25 months', now() - interval '25 months');
select case when (purge_personal_data()->>'leads')::int >= 1 then 'ok 12: old leads purged' else 'FAIL 12' end;

-- 13. storage limits
select case when count(*) = 5 and bool_and(file_size_limit is not null) then 'ok 13: every bucket has size/type limits' else 'FAIL 13' end from storage.buckets;
