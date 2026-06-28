-- =========================================================================
-- Allow Anon (unauthenticated) access to support auth-free local operation
-- =========================================================================

-- 1. connection_status
create policy "anon can read connection_status"
  on public.connection_status for select to anon using (true);
create policy "anon can update connection_status"
  on public.connection_status for update to anon using (true) with check (true);
create policy "anon can insert connection_status"
  on public.connection_status for insert to anon with check (true);
grant select, insert, update on public.connection_status to anon;

-- 2. system_health
create policy "anon can read system_health"
  on public.system_health for select to anon using (true);
grant select on public.system_health to anon;

-- 3. outbox
create policy "anon can manage outbox"
  on public.outbox for all to anon using (true) with check (true);
grant select, insert, update on public.outbox to anon;

-- 4. templates
create policy "anon can manage templates"
  on public.templates for all to anon using (true) with check (true);
grant select, insert, update, delete on public.templates to anon;

-- 5. api_keys
create policy "anon can manage api_keys"
  on public.api_keys for all to anon using (true) with check (true);
grant select, insert, update on public.api_keys to anon;

-- 6. settings
create policy "anon can read settings"
  on public.settings for select to anon using (true);
create policy "anon can update settings"
  on public.settings for update to anon using (true) with check (true);
create policy "anon can insert settings"
  on public.settings for insert to anon with check (true);
grant select, insert, update on public.settings to anon;

-- 7. audit_log
create policy "anon can read audit_log"
  on public.audit_log for select to anon using (true);
create policy "anon can insert audit_log"
  on public.audit_log for insert to anon with check (true);
grant select, insert on public.audit_log to anon;
