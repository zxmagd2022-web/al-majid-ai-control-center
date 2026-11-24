-- Proposal only: do not run until reviewed and approved.
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

-- Applicant can read only their own application. Director can read all.
create policy "staff_applications_read_own_or_director"
on public.staff_applications for select to authenticated
using (user_id = (select auth.uid()) or public.is_active_director());

-- Do not grant direct UPDATE/DELETE to applicants.
-- Application submission should be through a dedicated authenticated RPC that
-- derives user_id from auth.uid() and forces application_status='pending'.
-- Review should be through a director-only RPC which checks
-- public.is_active_director(), updates status, and only allows non-director
-- roles: admin, moderator, finance, reviewer, analytics.
-- It should create/update staff_directory and staff_roles transactionally.
-- Never write to am_ai_employees (that table is for AI staff only).
