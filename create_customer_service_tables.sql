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

create index if not exists idx_customer_service_tickets_status on public.customer_service_tickets(status);
create index if not exists idx_customer_service_tickets_category on public.customer_service_tickets(category);
create index if not exists idx_customer_service_tickets_updated_at on public.customer_service_tickets(updated_at desc);
create index if not exists idx_customer_service_messages_ticket_id on public.customer_service_messages(ticket_id);
create index if not exists idx_customer_service_leads_status on public.customer_service_leads(status);
create index if not exists idx_customer_service_leads_score on public.customer_service_leads(score);

alter table public.customer_service_tickets enable row level security;
alter table public.customer_service_messages enable row level security;
alter table public.customer_service_leads enable row level security;

create policy if not exists "authenticated can manage customer_service_tickets" on public.customer_service_tickets for all to authenticated using (true) with check (true);
create policy if not exists "authenticated can manage customer_service_messages" on public.customer_service_messages for all to authenticated using (true) with check (true);
create policy if not exists "authenticated can manage customer_service_leads" on public.customer_service_leads for all to authenticated using (true) with check (true);
