-- App-owned invitation records. Clerk remains the email/identity provider.
create table if not exists public.admin_invitations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  email_address text not null
    check (email_address = pg_catalog.lower(pg_catalog.btrim(email_address))),
  invited_by_clerk_user_id text not null
    references public.platform_users (clerk_user_id) on delete restrict,
  clerk_invitation_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired', 'failed')),
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default (pg_catalog.now() + interval '30 days'),
  accepted_at timestamptz,
  accepted_by_clerk_user_id text
    references public.platform_users (clerk_user_id) on delete restrict
);

create index if not exists admin_invitations_owner_created_at_idx
  on public.admin_invitations (invited_by_clerk_user_id, created_at desc);

create unique index if not exists admin_invitations_one_pending_per_email_idx
  on public.admin_invitations (pg_catalog.lower(email_address))
  where status = 'pending';

alter table public.admin_invitations enable row level security;
revoke all on table public.admin_invitations from public, anon, authenticated;
grant select on table public.admin_invitations to authenticated;

drop policy if exists admin_invitations_select_owner on public.admin_invitations;
create policy admin_invitations_select_owner
  on public.admin_invitations
  for select
  to authenticated
  using (
    invited_by_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1
      from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role = 'owner'
        and platform_user.status = 'active'
    )
  );

create or replace function public.admin_invitation_create(p_email_address text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id text := auth.jwt() ->> 'sub';
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email_address));
  invitation_ref uuid;
begin
  if actor_id is null or not exists (
    select 1
    from public.platform_users as platform_user
    where platform_user.clerk_user_id = actor_id
      and platform_user.role = 'owner'
      and platform_user.status = 'active'
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  if normalized_email is null
     or pg_catalog.char_length(normalized_email) > 254
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid email address' using errcode = '22023';
  end if;

  update public.admin_invitations
  set status = 'expired'
  where pg_catalog.lower(email_address) = normalized_email
    and status = 'pending'
    and expires_at <= pg_catalog.now();

  invitation_ref := pg_catalog.gen_random_uuid();
  insert into public.admin_invitations (
    id,
    email_address,
    invited_by_clerk_user_id,
    status,
    expires_at
  ) values (
    invitation_ref,
    normalized_email,
    actor_id,
    'pending',
    pg_catalog.now() + interval '30 days'
  );

  return invitation_ref;
end;
$function$;

create or replace function public.admin_invitation_mark_sent(
  p_invitation_ref uuid,
  p_clerk_invitation_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id text := auth.jwt() ->> 'sub';
  affected_rows integer;
begin
  if actor_id is null or not exists (
    select 1
    from public.platform_users as platform_user
    where platform_user.clerk_user_id = actor_id
      and platform_user.role = 'owner'
      and platform_user.status = 'active'
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  if p_clerk_invitation_id is null or pg_catalog.btrim(p_clerk_invitation_id) = '' then
    raise exception 'invalid Clerk invitation id' using errcode = '22023';
  end if;

  update public.admin_invitations
  set clerk_invitation_id = p_clerk_invitation_id
  where id = p_invitation_ref
    and invited_by_clerk_user_id = actor_id
    and status = 'pending'
    and clerk_invitation_id is null;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'invitation could not be marked sent' using errcode = 'P0002';
  end if;

  return true;
end;
$function$;

create or replace function public.admin_invitation_mark_failed(p_invitation_ref uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id text := auth.jwt() ->> 'sub';
begin
  if actor_id is null or not exists (
    select 1
    from public.platform_users as platform_user
    where platform_user.clerk_user_id = actor_id
      and platform_user.role = 'owner'
      and platform_user.status = 'active'
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  update public.admin_invitations
  set status = 'failed'
  where id = p_invitation_ref
    and invited_by_clerk_user_id = actor_id
    and status = 'pending'
    and clerk_invitation_id is null;

  return found;
end;
$function$;

create or replace function public.admin_invitation_revoke(p_invitation_ref uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id text := auth.jwt() ->> 'sub';
begin
  if actor_id is null or not exists (
    select 1
    from public.platform_users as platform_user
    where platform_user.clerk_user_id = actor_id
      and platform_user.role = 'owner'
      and platform_user.status = 'active'
  ) then
    raise exception 'owner access required' using errcode = '42501';
  end if;

  update public.admin_invitations
  set status = 'revoked'
  where id = p_invitation_ref
    and invited_by_clerk_user_id = actor_id
    and status = 'pending';

  return found;
end;
$function$;

-- This privileged acceptance RPC is called only after the server validates
-- Clerk's backend user, server-issued metadata, verified email, and invitation.
create or replace function public.admin_invitation_accept(
  p_invitation_ref uuid,
  p_clerk_user_id text,
  p_email_address text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invitation public.admin_invitations%rowtype;
  existing_role text;
  existing_status text;
begin
  if p_clerk_user_id is null or pg_catalog.btrim(p_clerk_user_id) = '' then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  select * into invitation
  from public.admin_invitations
  where id = p_invitation_ref
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if invitation.status = 'accepted'
     and invitation.accepted_by_clerk_user_id = p_clerk_user_id then
    return true;
  end if;

  if invitation.status <> 'pending' or invitation.expires_at <= pg_catalog.now() then
    raise exception 'invitation is not active' using errcode = '22023';
  end if;

  if p_email_address is null
     or invitation.email_address <> pg_catalog.lower(pg_catalog.btrim(p_email_address)) then
    raise exception 'invited email does not match verified account email' using errcode = '42501';
  end if;

  insert into public.platform_users (clerk_user_id, role, status)
  values (p_clerk_user_id, 'admin', 'active')
  on conflict (clerk_user_id) do nothing;

  select role, status into existing_role, existing_status
  from public.platform_users
  where clerk_user_id = p_clerk_user_id;

  if existing_role <> 'admin' or existing_status <> 'active' then
    raise exception 'user already has a different platform role' using errcode = '42501';
  end if;

  update public.admin_invitations
  set status = 'accepted',
      accepted_at = pg_catalog.now(),
      accepted_by_clerk_user_id = p_clerk_user_id
  where id = p_invitation_ref;

  return true;
end;
$function$;

revoke all on function public.admin_invitation_create(text) from public, anon, authenticated;
revoke all on function public.admin_invitation_mark_sent(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_invitation_mark_failed(uuid) from public, anon, authenticated;
revoke all on function public.admin_invitation_revoke(uuid) from public, anon, authenticated;
revoke all on function public.admin_invitation_accept(uuid, text, text) from public, anon, authenticated;

grant execute on function public.admin_invitation_create(text) to authenticated;
grant execute on function public.admin_invitation_mark_sent(uuid, text) to authenticated;
grant execute on function public.admin_invitation_mark_failed(uuid) to authenticated;
grant execute on function public.admin_invitation_revoke(uuid) to authenticated;
grant execute on function public.admin_invitation_accept(uuid, text, text) to service_role;
