-- Proposal only: do not run until reviewed and explicitly approved.
-- Staff applications are separate from AI employees and staff invitations.
create table if not exists public.staff_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  email text,
  phone text,
  department text,
  job_title text,
  application_status text not null default 'pending'
    check (application_status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_applications enable row level security;
revoke all on public.staff_applications from anon, authenticated;
grant select on public.staff_applications to authenticated;

drop policy if exists staff_applications_read_own_or_director on public.staff_applications;
create policy staff_applications_read_own_or_director
on public.staff_applications for select to authenticated
using (user_id = (select auth.uid()) or public.is_active_director());

-- Applicant submits only their own pending application; user_id/email are derived
-- from the authenticated session and auth.users, never accepted from the browser.
create or replace function public.submit_staff_application(
  p_full_name text,
  p_phone text default null,
  p_department text default null,
  p_job_title text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_application_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_full_name,''))) < 2 or length(trim(p_full_name)) > 120 then
    raise exception 'Invalid full name';
  end if;
  select email into v_email from auth.users where id = v_user_id;
  insert into public.staff_applications(user_id, full_name, email, phone, department, job_title)
  values (v_user_id, trim(p_full_name), v_email, nullif(trim(p_phone), ''),
          nullif(trim(p_department), ''), nullif(trim(p_job_title), ''))
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        department = excluded.department,
        job_title = excluded.job_title,
        application_status = 'pending',
        reviewed_by = null,
        reviewed_at = null,
        review_note = null,
        updated_at = now()
    where public.staff_applications.application_status = 'rejected'
  returning id into v_application_id;
  if v_application_id is null then
    select id into v_application_id from public.staff_applications where user_id = v_user_id;
    if v_application_id is null then raise exception 'Application could not be submitted'; end if;
    if exists (select 1 from public.staff_applications where id = v_application_id and application_status <> 'rejected') then
      raise exception 'An application already exists and is not rejected';
    end if;
  end if;
  return v_application_id;
end;
$$;

-- Only the active director can approve/reject and assign a non-director role.
create or replace function public.director_review_staff_application(
  p_application_id uuid,
  p_decision text,
  p_role text default null,
  p_department text default null,
  p_job_title text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_app public.staff_applications%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not coalesce(public.is_active_director(), false) then
    raise exception 'Active director permission required';
  end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  if p_decision = 'approved' and p_role not in ('admin','moderator','finance','reviewer','analytics') then
    raise exception 'Invalid staff role';
  end if;

  select * into v_app from public.staff_applications
    where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.application_status <> 'pending' then raise exception 'Application already reviewed'; end if;

  update public.staff_applications
    set application_status = p_decision,
        reviewed_by = v_actor,
        reviewed_at = now(),
        department = coalesce(nullif(trim(p_department),''), department),
        job_title = coalesce(nullif(trim(p_job_title),''), job_title),
        updated_at = now()
    where id = p_application_id;

  if p_decision = 'approved' then
    update public.profiles set account_status = 'active' where id = v_app.user_id;
    insert into public.staff_roles(user_id, role, is_active)
      values (v_app.user_id, p_role, true)
      on conflict (user_id) do update set role = excluded.role, is_active = true;
    update public.staff_directory
      set job_title = coalesce(nullif(trim(p_job_title),''), v_app.job_title),
          department = coalesce(nullif(trim(p_department),''), v_app.department),
          employment_status = 'active',
          updated_at = now()
      where user_id = v_app.user_id;
    if not found then
      insert into public.staff_directory(user_id, job_title, department, employment_status, hired_at, created_by)
      values (v_app.user_id, coalesce(nullif(trim(p_job_title),''), v_app.job_title),
              coalesce(nullif(trim(p_department),''), v_app.department),
              'active', now(), v_actor);
    end if;
  end if;
end;
$$;

revoke all on function public.submit_staff_application(text,text,text,text) from public, anon;
grant execute on function public.submit_staff_application(text,text,text,text) to authenticated;
revoke all on function public.director_review_staff_application(uuid,text,text,text,text) from public, anon;
grant execute on function public.director_review_staff_application(uuid,text,text,text,text) to authenticated;

-- Review the project's existing RLS policies and test with applicant, non-director,
-- and active-director accounts before applying this proposal.
-- Do not write to am_ai_employees: that table is for AI staff only.
