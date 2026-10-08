-- Agents MVP: create/list/open only. Instructions are write-only to Data API clients.
-- Limits count Unicode code points: name 1-120; instructions 1-20,000.
begin;

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  instructions text not null check (char_length(trim(instructions)) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index agents_organization_created_idx on public.agents (organization_id, created_at desc);
alter table public.agents enable row level security;
revoke all on table public.agents from public, anon, authenticated;
grant select (id, organization_id, name, created_at) on public.agents to authenticated;
grant insert (organization_id, name, instructions) on public.agents to authenticated;

create policy agents_select_owned on public.agents for select to authenticated
using (
  exists (
    select 1 from public.organizations as organization
    where organization.id = agents.organization_id
      and organization.owner_clerk_user_id = (select auth.jwt() ->> 'sub')
      and organization.archived_at is null
  )
  and exists (
    select 1 from public.platform_users as platform_user
    where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
      and platform_user.role in ('owner', 'admin')
      and platform_user.status = 'active'
  )
);
create policy agents_insert_owned on public.agents for insert to authenticated
with check (
  exists (
    select 1 from public.organizations as organization
    where organization.id = agents.organization_id
      and organization.owner_clerk_user_id = (select auth.jwt() ->> 'sub')
      and organization.archived_at is null
  )
  and exists (
    select 1 from public.platform_users as platform_user
    where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
      and platform_user.role in ('owner', 'admin')
      and platform_user.status = 'active'
  )
);
commit;
