-- ============================================
-- RVM Merchant Platform - New Supabase Bootstrap
-- Purpose: Create the minimum working schema for a clean new project
-- Run this FIRST in Supabase SQL Editor
-- ============================================

create extension if not exists pgcrypto;

-- ============================================
-- 1. CORE TABLES
-- ============================================

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency_symbol text default 'RM',
  rate_plastic numeric default 0,
  rate_paper numeric default 0,
  rate_uco numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.app_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'ADMIN',
  merchant_id uuid references public.merchants(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.machines (
  id bigserial primary key,
  device_no text unique not null,
  name text,
  merchant_id uuid references public.merchants(id) on delete cascade,
  location text,
  is_active boolean default true,
  is_manual_offline boolean default false,
  last_online_time timestamptz,
  sync_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  user_id text unique,
  full_name text,
  email text,
  phone text,
  total_weight numeric default 0,
  total_points numeric default 0,
  trust_score numeric default 50,
  status varchar(20) default 'ACTIVE',
  last_active_at timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  merchant_id uuid references public.merchants(id) on delete cascade,
  points numeric default 0,
  total_weight numeric default 0,
  waste_type text,
  created_at timestamptz default now()
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  merchant_id uuid references public.merchants(id) on delete cascade,
  amount numeric default 0,
  status text default 'PENDING',
  created_at timestamptz default now()
);

create table if not exists public.submission_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  merchant_id uuid references public.merchants(id) on delete cascade,
  device_no text,
  waste_type text,
  total_weight numeric default 0,
  points_awarded numeric default 0,
  status text default 'PENDING',
  photo_url text,
  created_at timestamptz default now(),
  is_delivered boolean default false,
  delivered_at timestamptz,
  delivered_by text
);

create table if not exists public.cleaning_records (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  device_no text,
  cleaner_name text,
  waste_type text,
  bag_weight_collected numeric default 0,
  status text default 'PENDING',
  photo_url text,
  admin_note text,
  cleaned_at timestamptz default now()
);

create table if not exists public.merchant_wallets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  balance numeric default 0,
  total_weight numeric default 0,
  updated_at timestamptz default now()
);

create table if not exists public.autogcm_records (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  device_no text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists public.rubbish_records (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  merchant_id uuid references public.merchants(id) on delete cascade,
  device_no text,
  waste_type text,
  total_weight numeric default 0,
  points numeric default 0,
  status text default 'COMPLETED',
  submitted_at timestamptz default now(),
  created_at timestamptz default now(),
  payload jsonb default '{}'::jsonb
);

create table if not exists public.recycling_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  machine_id text,
  device_no text,
  image_url text,
  waste_type text,
  weight_kg numeric default 0,
  points_awarded numeric default 0,
  status text default 'PENDING_REVIEW',
  verification_status text,
  verification_score numeric,
  submitted_at timestamptz default now(),
  created_at timestamptz default now(),
  payload jsonb default '{}'::jsonb
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  sync_type text not null,
  records_synced integer default 0,
  errors integer default 0,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds numeric,
  status text default 'pending',
  error_message text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.image_verifications (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid,
  user_id text,
  machine_id text,
  image_url text,
  ai_analysis jsonb default '{}'::jsonb,
  fraud_check jsonb default '{}'::jsonb,
  verification_score numeric default 0,
  verification_status text default 'PENDING_REVIEW',
  created_at timestamptz default now()
);

create table if not exists public.recycling_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  machine_id text,
  image_url text,
  weight_kg numeric default 0,
  material_type text,
  points_awarded numeric default 0,
  verification_score numeric default 0,
  ai_analysis jsonb default '{}'::jsonb,
  weight_validation jsonb default '{}'::jsonb,
  fraud_check jsonb default '{}'::jsonb,
  verification_result boolean default false,
  recommendations jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- 2. FEATURE TABLES FROM EXISTING SQL
-- ============================================

create table if not exists public.cleaning_logs (
  id uuid primary key default gen_random_uuid(),
  device_no text,
  cleaner_name text,
  status text not null default 'ISSUE_REPORTED',
  notes text,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  issue_category text,
  urgency_level text default 'Medium',
  photo_url text
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  title text not null,
  message text not null,
  type text not null default 'INFO',
  reference_id uuid,
  reference_type text,
  is_read boolean not null default false,
  created_at timestamptz default now(),
  read_at timestamptz
);

create table if not exists public.customer_service_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_phone text,
  customer_email text,
  company_name text,
  channel text not null default 'website',
  source text,
  category text not null default 'general',
  priority text not null default 'medium',
  status text not null default 'new',
  assigned_to text,
  ai_summary text,
  ai_sentiment text,
  ai_tags text[] default '{}',
  lead_score text,
  next_action text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_service_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.customer_service_tickets(id) on delete cascade,
  sender_type text not null,
  sender_name text,
  message text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_service_leads (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_phone text,
  customer_email text,
  company_name text,
  source text,
  interest_type text,
  score text not null default 'warm',
  status text not null default 'new',
  budget_range text,
  timeline text,
  location text,
  ai_summary text,
  ai_confidence numeric,
  assigned_to text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.customer_service_tickets(id) on delete cascade,
  type text not null check (type in ('summary', 'reply', 'action', 'sentiment')),
  content text not null,
  confidence numeric not null default 0.5,
  created_at timestamptz not null default now()
);

create table if not exists public.advertisements (
  id bigserial primary key,
  title varchar(255) not null,
  media_url text not null,
  media_type varchar(10) not null check (media_type in ('image', 'video')),
  duration integer check (duration is null or (media_type = 'video' and duration <= 30)),
  assigned_machines bigint[] default '{}',
  contact_number varchar(50) not null,
  status varchar(20) default 'inactive' check (status in ('active', 'inactive')),
  created_by uuid references public.app_admins(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.viewer_machine_assignments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.app_admins(id) on delete cascade,
  machine_id bigint not null references public.machines(id) on delete cascade,
  assigned_at timestamptz default now(),
  assigned_by uuid references public.app_admins(id),
  unique(admin_id, machine_id)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  title text,
  url text,
  type text,
  created_at timestamptz default now()
);

-- ============================================
-- 3. INDEXES
-- ============================================
create index if not exists idx_cleaning_logs_status on public.cleaning_logs(status);
create index if not exists idx_cleaning_logs_created_at on public.cleaning_logs(created_at desc);
create index if not exists idx_cleaning_logs_issue_category on public.cleaning_logs(issue_category);
create index if not exists idx_cleaning_logs_urgency_level on public.cleaning_logs(urgency_level);
create index if not exists idx_notifications_user_email on public.notifications(user_email);
create index if not exists idx_notifications_is_read on public.notifications(is_read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_customer_service_tickets_status on public.customer_service_tickets(status);
create index if not exists idx_customer_service_tickets_category on public.customer_service_tickets(category);
create index if not exists idx_customer_service_tickets_updated_at on public.customer_service_tickets(updated_at desc);
create index if not exists idx_customer_service_messages_ticket_id on public.customer_service_messages(ticket_id);
create index if not exists idx_customer_service_leads_status on public.customer_service_leads(status);
create index if not exists idx_customer_service_leads_score on public.customer_service_leads(score);
create index if not exists idx_viewer_assignments_admin on public.viewer_machine_assignments(admin_id);
create index if not exists idx_viewer_assignments_machine on public.viewer_machine_assignments(machine_id);
create index if not exists idx_submission_reviews_device_no on public.submission_reviews(device_no);
create index if not exists idx_submission_reviews_is_delivered on public.submission_reviews(is_delivered);
create index if not exists idx_users_status on public.users(status);
create index if not exists idx_users_total_weight on public.users(total_weight desc nulls last);
create index if not exists idx_users_last_active on public.users(last_active_at desc nulls last);
create index if not exists idx_rubbish_records_user_id on public.rubbish_records(user_id);
create index if not exists idx_rubbish_records_device_no on public.rubbish_records(device_no);
create index if not exists idx_rubbish_records_submitted_at on public.rubbish_records(submitted_at desc);
create index if not exists idx_recycling_submissions_user_id on public.recycling_submissions(user_id);
create index if not exists idx_recycling_submissions_status on public.recycling_submissions(status);
create index if not exists idx_sync_logs_sync_type on public.sync_logs(sync_type);
create index if not exists idx_sync_logs_started_at on public.sync_logs(started_at desc);
create index if not exists idx_image_verifications_submission_id on public.image_verifications(submission_id);
create index if not exists idx_recycling_verifications_user_id on public.recycling_verifications(user_id);

-- ============================================
-- 4. RLS + BASIC POLICIES
-- ============================================
alter table public.app_admins enable row level security;
alter table public.cleaning_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.customer_service_tickets enable row level security;
alter table public.customer_service_messages enable row level security;
alter table public.customer_service_leads enable row level security;
alter table public.viewer_machine_assignments enable row level security;
alter table public.advertisements enable row level security;

-- app_admins policies
 drop policy if exists "Allow authenticated read app_admins v2" on public.app_admins;
create policy "Allow authenticated read app_admins v2" on public.app_admins
  for select to authenticated using (true);

drop policy if exists "Allow Super Admin insert app_admins v2" on public.app_admins;
create policy "Allow Super Admin insert app_admins v2" on public.app_admins
  for insert to authenticated
  with check (exists (
    select 1 from public.app_admins where email = auth.jwt()->>'email' and role = 'SUPER_ADMIN'
  ));

drop policy if exists "Allow Super Admin update app_admins v2" on public.app_admins;
create policy "Allow Super Admin update app_admins v2" on public.app_admins
  for update to authenticated
  using (exists (
    select 1 from public.app_admins where email = auth.jwt()->>'email' and role = 'SUPER_ADMIN'
  ));

drop policy if exists "Allow Super Admin delete app_admins v2" on public.app_admins;
create policy "Allow Super Admin delete app_admins v2" on public.app_admins
  for delete to authenticated
  using (exists (
    select 1 from public.app_admins where email = auth.jwt()->>'email' and role = 'SUPER_ADMIN'
  ));

drop policy if exists "Allow user update own profile v2" on public.app_admins;
create policy "Allow user update own profile v2" on public.app_admins
  for update to authenticated using (email = auth.jwt()->>'email');

-- cleaning_logs policies
create policy "Allow read access to cleaning_logs" on public.cleaning_logs for select to authenticated using (true);
create policy "Allow insert access to cleaning_logs" on public.cleaning_logs for insert to authenticated with check (true);
create policy "Allow update access to cleaning_logs" on public.cleaning_logs for update to authenticated using (true) with check (true);

-- notifications policies
create policy "Allow users to read own notifications" on public.notifications for select to authenticated using (user_email = auth.jwt()->>'email');
create policy "Allow insert access to notifications" on public.notifications for insert to authenticated with check (true);
create policy "Allow users to update own notifications" on public.notifications for update to authenticated using (user_email = auth.jwt()->>'email');

-- customer service policies
create policy "authenticated can manage customer_service_tickets" on public.customer_service_tickets for all to authenticated using (true) with check (true);
create policy "authenticated can manage customer_service_messages" on public.customer_service_messages for all to authenticated using (true) with check (true);
create policy "authenticated can manage customer_service_leads" on public.customer_service_leads for all to authenticated using (true) with check (true);

-- viewer assignments policies
create policy "Users can view own assignments" on public.viewer_machine_assignments
  for select using (
    auth.jwt()->>'email' in (select email from public.app_admins where id = viewer_machine_assignments.admin_id)
  );
create policy "Super Admins can manage all" on public.viewer_machine_assignments
  for all using (
    exists (select 1 from public.app_admins where email = auth.jwt()->>'email' and role = 'SUPER_ADMIN')
  );

-- advertisements policies
create policy "Platform owners can manage all advertisements" on public.advertisements
  for all using (true)
  with check (
    exists (select 1 from public.app_admins where email = auth.jwt()->>'email' and role = 'SUPER_ADMIN')
  );

-- ============================================
-- 5. AUTH SUPPORT FUNCTION
-- ============================================
create or replace function public.check_admin_whitelist(check_email text)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.app_admins
    where email = check_email
  );
$$;

-- ============================================
-- 6. SEED ADMIN
-- ============================================
insert into public.app_admins (email, role, merchant_id)
values ('alfredli@hmadigital.asia', 'SUPER_ADMIN', null)
on conflict (email) do update set role = excluded.role, merchant_id = excluded.merchant_id;

-- ============================================
-- DONE
-- ============================================
select 'Bootstrap schema applied successfully' as result;
