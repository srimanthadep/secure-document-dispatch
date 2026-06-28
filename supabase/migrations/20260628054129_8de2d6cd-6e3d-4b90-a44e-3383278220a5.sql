
-- =========================================================================
-- updated_at trigger helper
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- whatsapp_sessions  (service-role only)
-- =========================================================================
create table public.whatsapp_sessions (
  id text primary key,
  data text not null,
  created_at timestamptz not null default now()
);

grant all on public.whatsapp_sessions to service_role;
alter table public.whatsapp_sessions enable row level security;
-- intentionally NO policies for anon/authenticated -> zero client access

-- =========================================================================
-- connection_status  (single-row, id=1)
-- =========================================================================
create table public.connection_status (
  id int primary key default 1,
  status text not null default 'disconnected'
    check (status in ('disconnected','awaiting_qr','connecting','connected')),
  qr_code text,
  last_connected_at timestamptz,
  sidecar_last_heartbeat_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint connection_status_singleton check (id = 1)
);

grant select, insert, update on public.connection_status to authenticated;
grant all on public.connection_status to service_role;
alter table public.connection_status enable row level security;

create policy "authenticated can read connection_status"
  on public.connection_status for select to authenticated using (true);
create policy "authenticated can update connection_status"
  on public.connection_status for update to authenticated using (true) with check (true);
create policy "authenticated can insert connection_status"
  on public.connection_status for insert to authenticated with check (true);

create trigger trg_connection_status_updated
  before update on public.connection_status
  for each row execute function public.set_updated_at();

insert into public.connection_status (id, status) values (1, 'disconnected');

-- =========================================================================
-- system_health  (single-row, id=1)
-- =========================================================================
create table public.system_health (
  id int primary key default 1,
  emudhra_circuit_state text not null default 'closed'
    check (emudhra_circuit_state in ('closed','open','half_open')),
  emudhra_last_failure_at timestamptz,
  emudhra_consecutive_failures int not null default 0,
  queue_depth int not null default 0,
  updated_at timestamptz not null default now(),
  constraint system_health_singleton check (id = 1)
);

grant select on public.system_health to authenticated;
grant all on public.system_health to service_role;
alter table public.system_health enable row level security;

create policy "authenticated can read system_health"
  on public.system_health for select to authenticated using (true);

create trigger trg_system_health_updated
  before update on public.system_health
  for each row execute function public.set_updated_at();

insert into public.system_health (id) values (1);

-- =========================================================================
-- api_keys  (service-role only for reads; authenticated can list metadata)
-- =========================================================================
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text not null unique,
  total_documents_sent int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

grant select, insert, update on public.api_keys to authenticated;
grant all on public.api_keys to service_role;
alter table public.api_keys enable row level security;

-- Authenticated owner can see metadata (label, dates, totals) but
-- key_hash is exposed too -- it's a hash, not the raw key, so safe.
create policy "authenticated can manage api_keys"
  on public.api_keys for all to authenticated using (true) with check (true);

-- =========================================================================
-- templates
-- =========================================================================
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null default 1,
  template_type text not null default 'static_pdf'
    check (template_type in ('static_pdf','merge_fields')),
  file_url text not null,
  fields_schema jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_templates_active on public.templates(active);
create index idx_templates_name_version on public.templates(name, version desc);

grant select, insert, update, delete on public.templates to authenticated;
grant all on public.templates to service_role;
alter table public.templates enable row level security;

create policy "authenticated can manage templates"
  on public.templates for all to authenticated using (true) with check (true);

-- =========================================================================
-- outbox
-- =========================================================================
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  api_key_id uuid references public.api_keys(id) on delete set null,
  idempotency_key text not null unique,
  customer_name text,
  customer_phone text not null,
  template_id uuid references public.templates(id) on delete set null,
  template_version int,
  merge_data jsonb,
  raw_pdf_url text,
  password_protected boolean not null default false,
  password_override text,
  status text not null default 'queued'
    check (status in ('queued','signing','encrypting','sending','sent','delivered','read','failed')),
  attempts int not null default 0,
  last_error text,
  signed_pdf_hash text,
  timestamp_token text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_outbox_status on public.outbox(status);
create index idx_outbox_created_at on public.outbox(created_at desc);
create index idx_outbox_source on public.outbox(source);
create index idx_outbox_signed_hash on public.outbox(signed_pdf_hash);

grant select, insert, update on public.outbox to authenticated;
grant all on public.outbox to service_role;
alter table public.outbox enable row level security;

create policy "authenticated can manage outbox"
  on public.outbox for all to authenticated using (true) with check (true);

create trigger trg_outbox_updated
  before update on public.outbox
  for each row execute function public.set_updated_at();

-- =========================================================================
-- audit_log  (INSERT-ONLY, no update/delete policy for any role)
-- =========================================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid references public.outbox(id) on delete set null,
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_outbox_id on public.audit_log(outbox_id);
create index idx_audit_log_created_at on public.audit_log(created_at desc);

grant select, insert on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;
alter table public.audit_log enable row level security;

create policy "authenticated can read audit_log"
  on public.audit_log for select to authenticated using (true);
create policy "authenticated can insert audit_log"
  on public.audit_log for insert to authenticated with check (true);
-- NO update/delete policies -> append-only

-- =========================================================================
-- settings  (single-row, id=1)
-- =========================================================================
create table public.settings (
  id int primary key default 1,
  password_rule text not null default 'last4_phone'
    check (password_rule in ('last4_phone','fixed','custom_per_document')),
  password_fixed_value text,
  lock_pdfs_enabled boolean not null default false,
  emudhra_enabled boolean not null default false,
  default_sender_label text,
  retention_years int not null default 8,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

grant select, insert, update on public.settings to authenticated;
grant all on public.settings to service_role;
alter table public.settings enable row level security;

create policy "authenticated can read settings"
  on public.settings for select to authenticated using (true);
create policy "authenticated can update settings"
  on public.settings for update to authenticated using (true) with check (true);
create policy "authenticated can insert settings"
  on public.settings for insert to authenticated with check (true);

create trigger trg_settings_updated
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (id) values (1);

-- =========================================================================
-- emudhra_credentials  (service-role only)
-- =========================================================================
create table public.emudhra_credentials (
  id int primary key default 1,
  api_key text,
  api_secret text,
  last_rotated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emudhra_credentials_singleton check (id = 1)
);

grant all on public.emudhra_credentials to service_role;
alter table public.emudhra_credentials enable row level security;
-- intentionally NO policies for anon/authenticated -> zero client access
-- (all reads/writes go through server functions using the service role,
--  which exposes only masked previews like "••••1234" to the UI.)

create trigger trg_emudhra_credentials_updated
  before update on public.emudhra_credentials
  for each row execute function public.set_updated_at();

insert into public.emudhra_credentials (id) values (1);

-- =========================================================================
-- Realtime
-- =========================================================================
alter publication supabase_realtime add table public.connection_status;
alter publication supabase_realtime add table public.system_health;
alter publication supabase_realtime add table public.outbox;
