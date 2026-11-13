-- VidEarn initial Supabase schema
-- Apply in Supabase SQL Editor. Never put the service_role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  referral_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10)),
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  video_url text,
  thumbnail_url text,
  category text not null default 'Entertainment',
  visibility text not null default 'public' check (visibility in ('public','unlisted','private')),
  status text not null default 'draft' check (status in ('draft','pending','published','rejected')),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','rejected')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_id <> referred_user_id)
);

-- Financial records are written by trusted server/admin code only.
create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  entry_type text not null check (entry_type in ('creator_share','referral_bonus','adjustment','payout')),
  amount numeric(12,2) not null,
  currency text not null default 'PKR',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- Initial illustrative revenue allocation. This is a platform policy setting,
-- not a promise of earnings. Publish the policy before enabling monetization.
create table if not exists public.platform_settings (
  setting_key text primary key,
  setting_value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (setting_key, setting_value)
values (
  'revenue_split',
  '{"platform_percent":70,"creator_percent":25,"referral_percent":5,"currency":"PKR","status":"draft"}'::jsonb
)
on conflict (setting_key) do nothing;

-- Create a profile on signup and optionally attach a valid referral code.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_profile_id uuid := new.id;
  supplied_code text := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
  referring_user_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new_profile_id, nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''));

  if supplied_code <> '' then
    select id into referring_user_id
    from public.profiles
    where referral_code = supplied_code
    limit 1;

    if referring_user_id is not null and referring_user_id <> new_profile_id then
      insert into public.referrals (referrer_id, referred_user_id, referral_code)
      values (referring_user_id, new_profile_id, supplied_code)
      on conflict (referred_user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_videarn on auth.users;
create trigger on_auth_user_created_videarn
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Prevent browser users from publishing directly or changing moderation state.
create or replace function public.guard_video_moderation_fields()
returns trigger
language plpgsql
as $
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' and new.status not in ('draft', 'pending') then
      raise exception 'Videos must be submitted as draft or pending';
    end if;
    if tg_op = 'UPDATE' then
      if new.owner_id <> old.owner_id then
        raise exception 'Video owner cannot be changed';
      end if;
      if new.status is distinct from old.status
         and not (old.status = 'draft' and new.status = 'pending') then
        raise exception 'Only trusted moderation can publish or reject videos';
      end if;
    end if;
  end if;
  return new;
end;
$;

drop trigger if exists guard_video_moderation_fields on public.videos;
create trigger guard_video_moderation_fields
  before insert or update on public.videos
  for each row execute procedure public.guard_video_moderation_fields();

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.platform_settings enable row level security;

-- Profiles are publicly readable for creator names/referral codes; users edit only themselves.
create policy "Profiles are viewable" on public.profiles
  for select using (true);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Published public videos are viewable" on public.videos
  for select using (
    (status = 'published' and visibility = 'public')
    or owner_id = auth.uid()
  );
create policy "Users create own videos" on public.videos
  for insert with check (auth.uid() = owner_id);
create policy "Users update own videos" on public.videos
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Users delete own videos" on public.videos
  for delete using (auth.uid() = owner_id);

create policy "Users view their referral records" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_user_id);

create policy "Users view own reward ledger" on public.reward_ledger
  for select using (auth.uid() = user_id);

-- No client insert/update/delete policies for referrals, ledger, or platform settings.
-- Trusted server functions using the Supabase service role will manage these tables.
