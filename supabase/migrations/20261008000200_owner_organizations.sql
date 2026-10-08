-- Permit active owners and admins while retaining creator-only isolation.
begin;

drop policy if exists organizations_select_own on public.organizations;
create policy organizations_select_own
  on public.organizations for select to authenticated
  using (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1 from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role in ('owner', 'admin')
        and platform_user.status = 'active'
    )
  );

drop policy if exists organizations_insert_own on public.organizations;
create policy organizations_insert_own
  on public.organizations for insert to authenticated

  with check (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1 from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role in ('owner', 'admin')
        and platform_user.status = 'active'
    )
  );

drop policy if exists organizations_update_own on public.organizations;
create policy organizations_update_own
  on public.organizations for update to authenticated
  using (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1 from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role in ('owner', 'admin')
        and platform_user.status = 'active'
    )
  )
  with check (
    owner_clerk_user_id = (select auth.jwt() ->> 'sub')
    and exists (
      select 1 from public.platform_users as platform_user
      where platform_user.clerk_user_id = (select auth.jwt() ->> 'sub')
        and platform_user.role in ('owner', 'admin')
        and platform_user.status = 'active'
    )
  );

commit;
