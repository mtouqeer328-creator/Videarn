-- VidEarn backend activation. Run AFTER supabase/schema.sql.
-- Safe to run again: policies are dropped before they are recreated.

-- Add the private Storage object path used by the application.
alter table public.videos add column if not exists video_path text;

-- Private bucket: playback is issued with short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos', 'videos', false, 524288000,
  array['video/mp4','video/webm','video/quicktime','video/x-m4v','video/ogg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Users can read their own objects; everyone else can read only approved public videos.
drop policy if exists "Video files are publicly readable" on storage.objects;
drop policy if exists "Owners and published videos can read files" on storage.objects;
drop policy if exists "Video files owner or published read" on storage.objects;
create policy "Video files owner or published read"
on storage.objects for select
using (
  bucket_id = 'videos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.videos v
      where v.video_path = name
        and v.status = 'published'
        and v.visibility = 'public'
    )
  )
);

drop policy if exists "Signed in users upload to own folder" on storage.objects;
create policy "Signed in users upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own video files" on storage.objects;
create policy "Users update own video files"
on storage.objects for update to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own video files" on storage.objects;
create policy "Users delete own video files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Owners can see their submissions; public visitors see approved public videos only.
drop policy if exists "Published public videos are viewable" on public.videos;
create policy "Published public videos are viewable"
on public.videos for select
using (
  (status = 'published' and visibility = 'public')
  or owner_id = auth.uid()
);

-- The existing schema trigger prevents browser clients from publishing/rejecting.
-- Moderation must be performed by trusted server/admin code only.
