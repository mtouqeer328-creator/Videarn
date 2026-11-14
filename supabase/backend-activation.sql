-- VidEarn backend activation: private-to-public reviewed video workflow.
-- Run this file once in Supabase SQL Editor after schema.sql.

-- Public playback bucket. Uploads are limited to 500 MB per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 524288000, array['video/mp4','video/webm','video/quicktime','video/x-m4v','video/ogg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Video files are publicly readable" on storage.objects;
create policy "Video files are publicly readable"
on storage.objects for select
using (bucket_id = 'videos');

drop policy if exists "Signed in users upload to own folder" on storage.objects;
create policy "Signed in users upload to own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own video files" on storage.objects;
create policy "Users update own video files"
on storage.objects for update to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own video files" on storage.objects;
create policy "Users delete own video files"
on storage.objects for delete to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Keep public listing restricted to approved content; owners can see their submissions.
drop policy if exists "Published public videos are viewable" on public.videos;
create policy "Published public videos are viewable" on public.videos
for select using (
  (status = 'published' and visibility = 'public')
  or owner_id = auth.uid()
);

-- Browser-created rows must stay in the review queue. Only trusted service-role
-- moderation code may publish/reject them using the guard trigger in schema.sql.
