-- Clerk is the identity provider. Store its subject as text; it is not a UUID.
-- Platform-user rows are provisioned only by a trusted owner/invitation flow.
create table if not exists public.platform_users (
  clerk_user_id text primary key,
  role text not null check (role in ('owner', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'blocked')),
  created_at timestamptz not null default now()
);

alter table public.platform_users enable row level security;
revoke all on table public.platform_users from public, anon, authenticated;
grant select on table public.platform_users to authenticated;

drop policy if exists platform_users_select_self on public.platform_users;
create policy platform_users_select_self
  on public.platform_users
  for select
  to authenticated
  using (clerk_user_id = (select auth.jwt() ->> 'sub'));

-- MVP organizations are private to their creator; hard deletion is not exposed.
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_clerk_user_id text not null
    default (auth.jwt() ->> 'sub')
    references public.platform_users (clerk_user_id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists organizations_owner_clerk_user_id_idx
  on public.organizations (owner_clerk_user_id);

alter table public.organizations enable row level security;
revoke all on table public.organizations from public, anon, authenticated;
grant select, insert, update on table public.organizations to authenticated;

drop policy if exists organizations_select_own on public.organizations;
create policy organizations_select_own
  on public.organizations
  for select
  to authenticated
  using (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1
      from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role = 'admin'
        and platform_user.status = 'active'
    )
  );

drop policy if exists organizations_insert_own on public.organizations;
create policy organizations_insert_own
  on public.organizations
  for insert
  to authenticated
  with check (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1
      from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role = 'admin'
        and platform_user.status = 'active'
    )
  );

drop policy if exists organizations_update_own on public.organizations;
create policy organizations_update_own
  on public.organizations
  for update
  to authenticated
  using (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1
      from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role = 'admin'
        and platform_user.status = 'active'
    )
  )
  with check (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1
      from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role = 'admin'
        and platform_user.status = 'active'
    )
  );
